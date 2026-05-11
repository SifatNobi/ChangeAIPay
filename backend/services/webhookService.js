import crypto from "crypto";
import logger from "./logger.js";
import User from "../models/User.js";
import UserSubscription from "../models/UserSubscription.js";
import Transaction from "../models/Transaction.js";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "changeaipay_webhook_secret_2024";
const DUPLICATE_WINDOW_MS = 300000;

class WebhookService {
  constructor() {
    this.processedEvents = new Map();
    this.cleanupInterval = null;
  }

  initialize() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupProcessedEvents();
    }, 3600000);
    logger.info("Webhook service initialized");
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  generateSignature(payload, timestamp) {
    const signature = `${timestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    return "sha256=" + hmac.update(signature).digest("hex");
  }

  verifySignature(payload, signature, timestamp) {
    if (!signature || !timestamp) {
      logger.warn("Missing signature or timestamp", { signature: !!signature, timestamp: !!timestamp });
      return false;
    }

    const payloadSignature = this.generateSignature(payload, timestamp);
    
    if (payloadSignature !== signature) {
      logger.warn("Signature mismatch", { expected: payloadSignature, received: signature });
      return false;
    }

    const requestTime = parseInt(timestamp, 10);
    const timeDiff = Math.abs(Date.now() - requestTime);
    
    if (timeDiff > 300000) {
      logger.warn("Webhook timestamp too old", { timeDiff });
      return false;
    }

    return true;
  }

  isEventProcessed(eventId) {
    const event = this.processedEvents.get(eventId);
    if (event) {
      logger.info("Duplicate webhook detected", { eventId });
      return true;
    }
    return false;
  }

  markEventProcessed(eventId, payload) {
    this.processedEvents.set(eventId, {
      processedAt: Date.now(),
      payloadHash: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")
    });
  }

  cleanupProcessedEvents() {
    const now = Date.now();
    for (const [eventId, data] of this.processedEvents.entries()) {
      if (now - data.processedAt > DUPLICATE_WINDOW_MS) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  async handleWebhookEvent(eventType, payload, headers) {
    const eventId = payload.eventId || `${eventType}_${Date.now()}`;
    
    if (this.isEventProcessed(eventId)) {
      return { success: false, reason: "duplicate_event" };
    }

    try {
      let result;
      
      switch (eventType) {
        case "payment.succeeded":
          result = await this.handlePaymentSuccess(payload);
          break;
        case "payment.failed":
          result = await this.handlePaymentFailed(payload);
          break;
        case "subscription.created":
          result = await this.handleSubscriptionCreated(payload);
          break;
        case "subscription.updated":
          result = await this.handleSubscriptionUpdated(payload);
          break;
        case "subscription.cancelled":
          result = await this.handleSubscriptionCancelled(payload);
          break;
        case "subscription.paused":
          result = await this.handleSubscriptionPaused(payload);
          break;
        case "subscription.resumed":
          result = await this.handleSubscriptionResumed(payload);
          break;
        case "invoice.paid":
          result = await this.handleInvoicePaid(payload);
          break;
        case "invoice.payment_failed":
          result = await this.handleInvoicePaymentFailed(payload);
          break;
        case "customer.created":
          result = await this.handleCustomerCreated(payload);
          break;
        case "customer.updated":
          result = await this.handleCustomerUpdated(payload);
          break;
        default:
          logger.warn("Unknown webhook event type", { eventType });
          result = { success: true, reason: "unknown_event_type" };
      }

      this.markEventProcessed(eventId, payload);
      
      await this.logWebhookEvent(eventType, payload, result);
      
      return result;
    } catch (err) {
      logger.error("Webhook processing error", { eventType, error: err.message, eventId });
      await this.logWebhookError(eventType, payload, err);
      return { success: false, error: err.message };
    }
  }

  async handlePaymentSuccess(payload) {
    const { userId, amount, currency, transactionId, paymentMethod } = payload;
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await Transaction.findByIdAndUpdate(transactionId, {
      status: "completed",
      metadata: { 
        ...payload.metadata, 
        webhookProcessed: true,
        webhookEventId: payload.eventId 
      }
    });

    logger.info("Payment webhook processed", { userId, amount, currency, transactionId });
    
    return { 
      success: true, 
      type: "payment_succeeded",
      transactionId,
      amount,
      currency
    };
  }

  async handlePaymentFailed(payload) {
    const { userId, amount, reason, transactionId } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription && subscription.metadata?.stripeSubscriptionId) {
      subscription.status = "past_due";
      subscription.retryCount = 0;
      subscription.failureReason = reason;
      await subscription.save();
    }

    await Transaction.findByIdAndUpdate(transactionId, {
      status: "failed",
      failureReason: reason
    });

    logger.warn("Payment failed webhook", { userId, reason, transactionId });

    return { success: true, type: "payment_failed", userId, reason };
  }

  async handleSubscriptionCreated(payload) {
    const { userId, plan, subscriptionId, status } = payload;
    
    const planConfig = {
      edge: { fiatPrice: 24.99, name: "Edge" },
      prime: { fiatPrice: 39.99, name: "Prime" },
      apex: { fiatPrice: 64.99, name: "Apex" }
    };

    let subscription = await UserSubscription.findOne({ userId });
    
    if (subscription) {
      subscription.plan = plan;
      subscription.status = status || "active";
      subscription.metadata = {
        ...subscription.metadata,
        stripeSubscriptionId: subscriptionId,
        paymentMethod: payload.paymentMethod || "card"
      };
      subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await subscription.save();
    } else {
      subscription = await UserSubscription.create({
        userId,
        plan,
        status: status || "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: {
          stripeSubscriptionId: subscriptionId,
          paymentMethod: payload.paymentMethod || "card"
        }
      });
    }

    await User.findByIdAndUpdate(userId, { subscriptionPlan: plan });

    logger.info("Subscription created via webhook", { userId, plan, subscriptionId });

    return { success: true, type: "subscription_created", plan };
  }

  async handleSubscriptionUpdated(payload) {
    const { userId, plan, status, subscriptionId } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription) {
      if (plan) subscription.plan = plan;
      if (status) subscription.status = status;
      if (subscriptionId) subscription.metadata.stripeSubscriptionId = subscriptionId;
      await subscription.save();

      await User.findByIdAndUpdate(userId, { subscriptionPlan: plan });
    }

    logger.info("Subscription updated via webhook", { userId, plan, status });

    return { success: true, type: "subscription_updated" };
  }

  async handleSubscriptionCancelled(payload) {
    const { userId, subscriptionId, cancelAtPeriodEnd } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription) {
      if (cancelAtPeriodEnd) {
        subscription.willCancelAt = subscription.currentPeriodEnd;
      } else {
        subscription.status = "cancelled";
        subscription.cancelledAt = new Date();
        await User.findByIdAndUpdate(userId, { subscriptionPlan: "free_trial" });
      }
      await subscription.save();
    }

    logger.info("Subscription cancelled via webhook", { userId, cancelAtPeriodEnd });

    return { success: true, type: "subscription_cancelled" };
  }

  async handleSubscriptionPaused(payload) {
    const { userId } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription) {
      subscription.status = "paused";
      subscription.pausedAt = new Date();
      subscription.pauseReason = "payment_gateway_pause";
      await subscription.save();
    }

    logger.info("Subscription paused via webhook", { userId });

    return { success: true, type: "subscription_paused" };
  }

  async handleSubscriptionResumed(payload) {
    const { userId } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription && subscription.status === "paused") {
      const pauseDuration = Date.now() - subscription.pausedAt.getTime();
      subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + pauseDuration);
      subscription.status = "active";
      subscription.pausedAt = null;
      await subscription.save();
    }

    logger.info("Subscription resumed via webhook", { userId });

    return { success: true, type: "subscription_resumed" };
  }

  async handleInvoicePaid(payload) {
    const { userId, invoiceId, amount, currency } = payload;
    
    logger.info("Invoice paid webhook", { userId, invoiceId, amount, currency });

    return { success: true, type: "invoice_paid", invoiceId };
  }

  async handleInvoicePaymentFailed(payload) {
    const { userId, invoiceId, amount } = payload;
    
    const subscription = await UserSubscription.findOne({ userId });
    
    if (subscription) {
      subscription.retryCount = (subscription.retryCount || 0) + 1;
      subscription.status = "past_due";
      subscription.failureReason = "invoice_payment_failed";
      await subscription.save();
    }

    logger.warn("Invoice payment failed webhook", { userId, invoiceId, amount });

    return { success: true, type: "invoice_payment_failed", invoiceId };
  }

  async handleCustomerCreated(payload) {
    const { userId, customerId } = payload;
    
    await User.findByIdAndUpdate(userId, {
      "metadata.stripeCustomerId": customerId
    });

    logger.info("Customer created via webhook", { userId, customerId });

    return { success: true, type: "customer_created" };
  }

  async handleCustomerUpdated(payload) {
    const { userId, customerId } = payload;
    
    await User.findByIdAndUpdate(userId, {
      "metadata.stripeCustomerId": customerId
    });

    logger.info("Customer updated via webhook", { userId, customerId });

    return { success: true, type: "customer_updated" };
  }

  async logWebhookEvent(eventType, payload, result) {
    const logEntry = {
      timestamp: new Date(),
      eventType,
      eventId: payload.eventId,
      userId: payload.userId,
      result: result.success ? "success" : "failure",
      reason: result.reason,
      metadata: {
        payloadSize: JSON.stringify(payload).length,
        processedAt: Date.now()
      }
    };

    logger.info("Webhook event logged", logEntry);
  }

  async logWebhookError(eventType, payload, error) {
    const logEntry = {
      timestamp: new Date(),
      eventType,
      eventId: payload.eventId,
      userId: payload.userId,
      result: "error",
      error: error.message,
      stack: error.stack
    };

    logger.error("Webhook error logged", logEntry);
  }

  async reconcileTransaction(transactionId, expectedAmount, expectedCurrency) {
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      return { reconciled: false, reason: "transaction_not_found" };
    }

    const amountMatch = Math.abs(transaction.amount - expectedAmount) < 0.01;
    const currencyMatch = transaction.currency === expectedCurrency;

    if (amountMatch && currencyMatch) {
      return { reconciled: true, status: "matched" };
    }

    return { 
      reconciled: false, 
      reason: amountMatch ? "currency_mismatch" : "amount_mismatch",
      transactionStatus: transaction.status,
      expected: { amount: expectedAmount, currency: expectedCurrency },
      actual: { amount: transaction.amount, currency: transaction.currency }
    };
  }

  async getWebhookStats(days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return {
      period: { start: startDate, end: new Date() },
      eventsProcessed: this.processedEvents.size,
      duplicatePrevention: true,
      securityFeatures: {
        signatureVerification: true,
        replayAttackPrevention: true,
        timestampValidation: true
      }
    };
  }
}

const webhookService = new WebhookService();

export const verifyWebhookSignature = (payload, signature, timestamp) => 
  webhookService.verifySignature(payload, signature, timestamp);
export const handleWebhookEvent = (eventType, payload, headers) => 
  webhookService.handleWebhookEvent(eventType, payload, headers);
export const getWebhookStats = (days) => webhookService.getWebhookStats(days);
export const reconcileTransaction = (id, amount, currency) => 
  webhookService.reconcileTransaction(id, amount, currency);

export default webhookService;