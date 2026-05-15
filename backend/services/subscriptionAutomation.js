import UserSubscription from "../models/UserSubscription.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { convertFiatToNano, getCurrentRates } from "./conversionService.js";
import logger from "./logger.js";
import emailService from "./emailService.js";

const PLANS_CONFIG = {
  edge: { fiatPrice: 19.99, name: "Edge", periodDays: 30 },
  prime: { fiatPrice: 29.99, name: "Prime", periodDays: 30 },
  apex: { fiatPrice: 49.99, name: "Apex", periodDays: 30 }
};

const GRACE_PERIOD_DAYS = 5;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [86400000, 172800000, 259200000];

class SubscriptionAutomationService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.checkInterval = setInterval(() => {
      this.processScheduledRenewals().catch(err => 
        logger.error("Renewal processing error", { error: err.message })
      );
      this.checkGracePeriods().catch(err =>
        logger.error("Grace period check error", { error: err.message })
      );
    }, 3600000);

    logger.info("Subscription automation started");
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.isRunning = false;
      logger.info("Subscription automation stopped");
    }
  }

  async processScheduledRenewals() {
    const now = new Date();
    const subscriptions = await UserSubscription.find({
      status: "active",
      autoRenew: { $ne: false },
      currentPeriodEnd: { $lte: now }
    }).populate("userId");

    for (const sub of subscriptions) {
      await this.processRenewal(sub);
    }
  }

  async processRenewal(subscription) {
    const user = subscription.userId;
    const planConfig = PLANS_CONFIG[subscription.plan];
    
    if (!planConfig) {
      logger.error("Invalid plan for renewal", { plan: subscription.plan, userId: user._id });
      return;
    }

    logger.info("Processing subscription renewal", { 
      userId: user._id, 
      plan: subscription.plan 
    });

    const paymentMethod = subscription.metadata?.paymentMethod || "fiat";
    
    if (paymentMethod === "nano") {
      await this.processNanoRenewal(subscription, user, planConfig);
    } else {
      await this.processFiatRenewal(subscription, user, planConfig);
    }
  }

  async processNanoRenewal(subscription, user, planConfig) {
    const nanoBalance = parseFloat(user.balance?.balanceNano || "0");
    const conversion = await convertFiatToNano(planConfig.fiatPrice, "EUR");

    if (nanoBalance >= conversion.nanoAmount) {
      await User.findByIdAndUpdate(user._id, {
        "balance.balanceNano": Math.max(0, nanoBalance - conversion.nanoAmount)
      });

      await this.extendSubscriptionPeriod(subscription, planConfig.periodDays);
      
      await this.generateInvoice(user, subscription, planConfig, "nano", conversion.nanoAmount);
      
      await this.sendRenewalConfirmation(user, planConfig, conversion.nanoAmount, "nano");

      logger.info("Nano renewal successful", { userId: user._id, amount: conversion.nanoAmount });
    } else {
      await this.handleFailedPayment(subscription, user, planConfig, "nano", "insufficient_balance");
    }
  }

  async processFiatRenewal(subscription, user, planConfig) {
    subscription.status = "past_due";
    subscription.retryCount = 0;
    subscription.failureReason = "pending_payment";
    await subscription.save();

    await this.sendPaymentDueNotification(user, planConfig);

    logger.info("Fiat renewal marked as past_due", { userId: user._id });
  }

  async extendSubscriptionPeriod(subscription, days) {
    const newEnd = new Date(subscription.currentPeriodEnd.getTime() + days * 24 * 60 * 60 * 1000);
    subscription.currentPeriodStart = subscription.currentPeriodEnd;
    subscription.currentPeriodEnd = newEnd;
    subscription.usage = {
      fxUsedThisMonth: 0,
      aiChatsThisMonth: 0,
      transactionsThisMonth: 0,
      amountSentThisMonth: 0
    };
    await subscription.save();
  }

  async handleFailedPayment(subscription, user, planConfig, method, reason) {
    subscription.retryCount = subscription.retryCount || 0;
    subscription.failureReason = reason;

    if (subscription.retryCount < MAX_RETRY_ATTEMPTS) {
      subscription.status = "past_due";
      subscription.nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[subscription.retryCount]);
      subscription.retryCount += 1;
      await subscription.save();

      await this.sendRetryNotification(user, planConfig, subscription.retryCount, MAX_RETRY_ATTEMPTS);

      logger.warn("Payment failed, scheduled retry", { 
        userId: user._id, 
        retryCount: subscription.retryCount 
      });
    } else {
      await this.handleMaxRetries(subscription, user, planConfig);
    }
  }

  async handleMaxRetries(subscription, user, planConfig) {
    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.failureReason = "max_retries_exceeded";
    await subscription.save();

    await User.findByIdAndUpdate(user._id, { subscriptionPlan: "free_trial" });

    await this.sendSubscriptionEndedNotification(user, planConfig, "payment_failed");

    logger.info("Subscription cancelled due to failed payments", { userId: user._id });
  }

  async checkGracePeriods() {
    const gracePeriodEnd = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    
    const pastDueSubs = await UserSubscription.find({
      status: "past_due",
      currentPeriodEnd: { $gte: gracePeriodEnd }
    }).populate("userId");

    for (const sub of pastDueSubs) {
      const user = sub.userId;
      const planConfig = PLANS_CONFIG[sub.plan];

      if (sub.retryCount >= MAX_RETRY_ATTEMPTS) {
        await this.handleMaxRetries(sub, user, planConfig);
      } else {
        await this.triggerRetry(sub);
      }
    }
  }

  async triggerRetry(subscription) {
    const user = await User.findById(subscription.userId);
    const planConfig = PLANS_CONFIG[subscription.plan];
    const paymentMethod = subscription.metadata?.paymentMethod;

    if (paymentMethod === "nano") {
      const nanoBalance = parseFloat(user.balance?.balanceNano || "0");
      const conversion = await convertFiatToNano(planConfig.fiatPrice, "EUR");

      if (nanoBalance >= conversion.nanoAmount) {
        await User.findByIdAndUpdate(user._id, {
          "balance.balanceNano": Math.max(0, nanoBalance - conversion.nanoAmount)
        });

        await this.extendSubscriptionPeriod(subscription, planConfig.periodDays);
        
        subscription.status = "active";
        subscription.failureReason = null;
        subscription.retryCount = 0;
        await subscription.save();

        await this.sendRenewalConfirmation(user, planConfig, conversion.nanoAmount, "nano");

        logger.info("Retry payment successful", { userId: user._id });
      }
    }
  }

  async pauseSubscription(userId, reason = "user_request") {
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription || subscription.status !== "active") {
      throw new Error("Cannot pause: subscription not active");
    }

    subscription.status = "paused";
    subscription.pausedAt = new Date();
    subscription.pauseReason = reason;
    await subscription.save();

    logger.info("Subscription paused", { userId, reason });
    return subscription;
  }

  async resumeSubscription(userId) {
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription || subscription.status !== "paused") {
      throw new Error("Cannot resume: subscription not paused");
    }

    const pauseDuration = Date.now() - subscription.pausedAt.getTime();
    subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + pauseDuration);
    subscription.status = "active";
    subscription.pausedAt = null;
    subscription.pauseReason = null;
    await subscription.save();

    logger.info("Subscription resumed", { userId });
    return subscription;
  }

  async calculateProration(userId, newPlanId, prorationDate = new Date()) {
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription) throw new Error("Subscription not found");

    const currentPlan = PLANS_CONFIG[subscription.plan];
    const newPlan = PLANS_CONFIG[newPlanId];

    if (!currentPlan || !newPlan) throw new Error("Invalid plan");

    const daysRemaining = Math.ceil(
      (subscription.currentPeriodEnd - prorationDate) / (24 * 60 * 60 * 1000)
    );

    const dailyCurrentRate = currentPlan.fiatPrice / 30;
    const dailyNewRate = newPlan.fiatPrice / 30;

    const creditRemaining = Math.max(0, dailyCurrentRate * daysRemaining);
    const newPlanCost = newPlan.fiatPrice;
    const amountOwed = Math.max(0, newPlanCost - creditRemaining);

    return {
      currentPlan: subscription.plan,
      newPlan: newPlanId,
      daysRemaining,
      creditRemaining: Math.round(creditRemaining * 100) / 100,
      newPlanCost: Math.round(newPlanCost * 100) / 100,
      amountOwed: Math.round(amountOwed * 100) / 100,
      effectiveDate: prorationDate
    };
  }

  async upgradePlan(userId, newPlanId, paymentMethod = "nano") {
    const proration = await this.calculateProration(userId, newPlanId);
    const newPlan = PLANS_CONFIG[newPlanId];
    const user = await User.findById(userId);

    if (paymentMethod === "nano") {
      const conversion = await convertFiatToNano(proration.amountOwed, "EUR");
      const nanoBalance = parseFloat(user.balance?.balanceNano || "0");

      if (nanoBalance >= conversion.nanoAmount) {
        await User.findByIdAndUpdate(userId, {
          "balance.balanceNano": Math.max(0, nanoBalance - conversion.nanoAmount)
        });
      } else {
        throw new Error("Insufficient Nano balance for upgrade");
      }
    }

    const subscription = await UserSubscription.findOne({ userId });
    subscription.plan = newPlanId;
    subscription.status = "active";
    subscription.currentPeriodStart = proration.effectiveDate;
    subscription.currentPeriodEnd = new Date(
      proration.effectiveDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    subscription.metadata = { ...subscription.metadata, paymentMethod };
    await subscription.save();

    await User.findByIdAndUpdate(userId, { subscriptionPlan: newPlanId });

    logger.info("Plan upgraded", { userId, newPlan: newPlanId, proration: proration.amountOwed });
    return { subscription, proration };
  }

  async downgradePlan(userId, newPlanId) {
    const proration = await this.calculateProration(userId, newPlanId);
    
    const subscription = await UserSubscription.findOne({ userId });
    subscription.plan = newPlanId;
    subscription.currentPeriodStart = proration.effectiveDate;
    subscription.currentPeriodEnd = new Date(
      proration.effectiveDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    await subscription.save();

    await User.findByIdAndUpdate(userId, { subscriptionPlan: newPlanId });

    logger.info("Plan downgraded", { userId, newPlan: newPlanId, credit: proration.creditRemaining });
    return { subscription, proration };
  }

  async generateInvoice(user, subscription, planConfig, method, amount = null) {
    const invoice = {
      id: `INV-${Date.now()}-${user._id}`,
      userId: user._id,
      subscriptionId: subscription._id,
      plan: planConfig.name,
      amount: amount || planConfig.fiatPrice,
      currency: method === "nano" ? "XNO" : "EUR",
      paymentMethod: method,
      status: "paid",
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      createdAt: new Date()
    };

    logger.info("Invoice generated", invoice);
    return invoice;
  }

  async sendRenewalConfirmation(user, planConfig, nanoAmount, method) {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #00D4FF; margin: 0;">ChangeAIPay</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #333;">Subscription Renewed</h2>
          <p>Your ${planConfig.name} subscription has been automatically renewed.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Plan:</strong> ${planConfig.name}</p>
            <p><strong>Amount:</strong> ${method === "nano" ? `${nanoAmount.toFixed(4)} XNO` : `€${planConfig.fiatPrice}`}</p>
            <p><strong>Next Renewal:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">Thank you for choosing ChangeAIPay!</p>
        </div>
      </div>
    `;

    try {
      await emailService.sendEmail(user.email, "Subscription Renewed - ChangeAIPay", emailHtml);
    } catch (err) {
      logger.warn("Failed to send renewal email", { error: err.message });
    }
  }

  async sendPaymentDueNotification(user, planConfig) {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #00D4FF; margin: 0;">ChangeAIPay</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #e74c3c;">Payment Due</h2>
          <p>Your ${planConfig.name} subscription payment is due.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Amount:</strong> €${planConfig.fiatPrice}</p>
            <p><strong>Due Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <p>Please update your payment method to continue your subscription.</p>
        </div>
      </div>
    `;

    try {
      await emailService.sendEmail(user.email, "Payment Due - ChangeAIPay", emailHtml);
    } catch (err) {
      logger.warn("Failed to send payment due email", { error: err.message });
    }
  }

  async sendRetryNotification(user, planConfig, currentRetry, maxRetries) {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #00D4FF; margin: 0;">ChangeAIPay</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #e67e22;">Payment Retry</h2>
          <p>Your payment could not be processed. We'll retry automatically.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Attempt:</strong> ${currentRetry} of ${maxRetries}</p>
            <p><strong>Amount:</strong> €${planConfig.fiatPrice}</p>
          </div>
          <p>Ensure you have sufficient balance to avoid service interruption.</p>
        </div>
      </div>
    `;

    try {
      await emailService.sendEmail(user.email, "Payment Retry - ChangeAIPay", emailHtml);
    } catch (err) {
      logger.warn("Failed to send retry email", { error: err.message });
    }
  }

  async sendSubscriptionEndedNotification(user, planConfig, reason) {
    const reasonText = reason === "payment_failed" 
      ? "due to failed payments" 
      : "as requested";
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #00D4FF; margin: 0;">ChangeAIPay</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #e74c3c;">Subscription Ended</h2>
          <p>Your ${planConfig.name} subscription has ended ${reasonText}.</p>
          <p>You have been moved to the Free Trial plan.</p>
          <p>To restore your plan, please update your payment method.</p>
        </div>
      </div>
    `;

    try {
      await emailService.sendEmail(user.email, "Subscription Ended - ChangeAIPay", emailHtml);
    } catch (err) {
      logger.warn("Failed to send subscription ended email", { error: err.message });
    }
  }

  async getSubscriptionAnalytics(userId) {
    const user = await User.findById(userId);
    const subscription = await UserSubscription.findOne({ userId });
    const transactions = await Transaction.find({ 
      userId, 
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const totalVolume = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const fxAmount = transactions.reduce((sum, t) => sum + (t.fxAmount || 0), 0);
    
    const planConfig = PLANS_CONFIG[subscription?.plan];
    const fxFeeRate = planConfig?.limits?.fxFeeAfterLimit || 1.45;
    const fxFreeAmount = planConfig?.limits?.fxFreeAmount || 0;
    
    const potentialSavings = Math.min(fxAmount, fxFreeAmount) * (1.45 - fxFeeRate) / 100;
    const currentFXSavings = fxAmount > fxFreeAmount 
      ? (fxAmount - fxFreeAmount) * fxFeeRate / 100 
      : fxAmount * fxFeeRate / 100;

    return {
      userId,
      plan: subscription?.plan || "free_trial",
      status: subscription?.status || "none",
      daysUntilRenewal: subscription?.currentPeriodEnd 
        ? Math.ceil((subscription.currentPeriodEnd - new Date()) / (24 * 60 * 60 * 1000))
        : 30,
      transactionVolume: totalVolume,
      fxVolume: fxAmount,
      transactionCount: transactions.length,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
      currentFXSavings: Math.round(currentFXSavings * 100) / 100,
      fxFeeRate,
      fxFreeAmount,
      autoRenew: subscription?.settings?.autoRenew ?? true,
      paymentMethod: subscription?.metadata?.paymentMethod || "none"
    };
  }
}

const subscriptionAutomation = new SubscriptionAutomationService();

export const startSubscriptionAutomation = () => subscriptionAutomation.start();
export const stopSubscriptionAutomation = () => subscriptionAutomation.stop();
export const pauseSubscription = (userId, reason) => subscriptionAutomation.pauseSubscription(userId, reason);
export const resumeSubscription = (userId) => subscriptionAutomation.resumeSubscription(userId);
export const calculateProration = (userId, newPlanId, date) => subscriptionAutomation.calculateProration(userId, newPlanId, date);
export const upgradePlan = (userId, newPlanId, method) => subscriptionAutomation.upgradePlan(userId, newPlanId, method);
export const downgradePlan = (userId, newPlanId) => subscriptionAutomation.downgradePlan(userId, newPlanId);
export const getSubscriptionAnalytics = (userId) => subscriptionAutomation.getSubscriptionAnalytics(userId);

export default subscriptionAutomation;