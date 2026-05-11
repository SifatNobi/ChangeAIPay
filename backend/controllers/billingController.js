import User from "../models/User.js";
import UserSubscription from "../models/UserSubscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { convertFiatToNano, lockConversion, calculateFee, calculateSavings, getCurrentRates } from "../services/conversionService.js";
import logger from "../services/logger.js";
import { 
  pauseSubscription as pauseSubscriptionService, 
  resumeSubscription as resumeSubscriptionService, 
  calculateProration as calculateProrationService, 
  upgradePlan as upgradePlanService, 
  downgradePlan as downgradePlanService,
  getSubscriptionAnalytics as getSubscriptionAnalyticsService 
} from "../services/subscriptionAutomation.js";
import { 
  getRecommendations, 
  getPlanComparison, 
  getRenewalReminder, 
  generateFinaMessage,
  PLANS_CONFIG 
} from "../services/recommendationEngine.js";

export async function getPricingPlans(req, res) {
  try {
    const currency = req.query.currency || "EUR";
    const rates = await getCurrentRates();
    const nanoPrice = rates[currency];

    const plans = [
      {
        id: "free_trial",
        name: "Free Trial",
        description: "Basic AI finance chat payments",
        fiatPrice: 0,
        nanoPrice: 0,
        currency,
        features: ["Basic AI chat", "Send/request money", "Basic fraud alerts", "Smart transcripts"]
      },
      {
        id: "edge",
        name: "Edge",
        description: "Full AI assistant with fraud protection",
        fiatPrice: 24.99,
        nanoPrice: Math.round((24.99 / nanoPrice) * 1e6) / 1e6,
        currency,
        fxFee: "0.95%",
        fxFreeLimit: 1000,
        features: ["Full AI Assistant", "Fraud Protection", "Smart Routing", "Predictive Reminders", "Spending Alerts"]
      },
      {
        id: "prime",
        name: "Prime",
        description: "AI Financial Autopilot",
        fiatPrice: 39.99,
        nanoPrice: Math.round((39.99 / nanoPrice) * 1e6) / 1e6,
        currency,
        fxFee: "0.72%",
        fxFreeLimit: 3000,
        features: ["AI Financial Autopilot", "Smart Undo Payments", "Social Payments Brain", "Advanced Fraud Detection", "Dynamic Budget"]
      },
      {
        id: "apex",
        name: "Apex",
        description: "Autonomous AI Payments",
        fiatPrice: 64.99,
        nanoPrice: Math.round((64.99 / nanoPrice) * 1e6) / 1e6,
        currency,
        fxFee: "0.58%",
        fxFreeLimit: 6000,
        features: ["Autonomous AI Payments", "AI Negotiator", "Life Event Mode", "Priority Routing", "Booking Workflows"]
      }
    ];

    res.json({ 
      success: true, 
      plans,
      rates,
      paymentOptions: {
        fiat: ["EUR", "USD"],
        crypto: ["XNO"],
        preferred: "fiat"
      }
    });
  } catch (err) {
    logger.error("Pricing fetch error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to fetch pricing" });
  }
}

export async function createCheckoutSession(req, res) {
  try {
    const userId = req.user._id;
    const { planId, currency = "EUR", paymentMethod = "fiat" } = req.body;

    const planConfig = {
      edge: { fiatPrice: 24.99, name: "Edge" },
      prime: { fiatPrice: 39.99, name: "Prime" },
      apex: { fiatPrice: 64.99, name: "Apex" }
    };

    const plan = planConfig[planId];
    if (!plan) {
      return res.status(400).json({ success: false, error: "Invalid plan" });
    }

    const user = await User.findById(userId).lean();
    const nanoBalance = parseFloat(user?.balance?.balanceNano || "0");

    const conversion = await lockConversion(plan.fiatPrice, currency, 600000);

    const savings = calculateSavings(plan.fiatPrice);

    const checkoutSession = {
      id: `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      plan: planId,
      planName: plan.name,
      currency,
      paymentMethod,
      pricing: {
        fiatAmount: plan.fiatPrice,
        nanoAmount: conversion.nanoAmount,
        conversionRate: conversion.rate,
        lockedUntil: conversion.expiresAt
      },
      userBalance: {
        nanoBalance,
        canPayWithNano: nanoBalance >= conversion.nanoAmount
      },
      savings: paymentMethod === "xno" ? savings : null,
      fees: calculateFee(plan.fiatPrice, paymentMethod === "xno"),
      status: "pending",
      createdAt: new Date().toISOString()
    };

    logger.info("Checkout session created", { userId, planId, paymentMethod });

    res.json({
      success: true,
      session: checkoutSession,
      recommendations: {
        suggestNano: nanoBalance >= conversion.nanoAmount && nanoBalance > 0,
        nanoSavings: savings.savings,
        reason: nanoBalance >= conversion.nanoAmount 
          ? "You have enough Nano to pay and save card fees"
          : "Add Nano to your wallet to enable fee-less payments"
      }
    });
  } catch (err) {
    logger.error("Checkout error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to create checkout" });
  }
}

export async function processPayment(req, res) {
  try {
    const userId = req.user._id;
    const { sessionId, paymentMethod, paymentData } = req.body;

    const user = await User.findById(userId).lean();
    const nanoBalance = parseFloat(user?.balance?.balanceNano || "0");

    const planId = sessionId.split("_")[1] || "edge";
    const planConfig = {
      edge: { fiatPrice: 24.99, name: "Edge" },
      prime: { fiatPrice: 39.99, name: "Prime" },
      apex: { fiatPrice: 64.99, name: "Apex" }
    };
    const plan = planConfig[planId];

    if (paymentMethod === "xno") {
      const conversion = await convertFiatToNano(plan.fiatPrice, "EUR");

      if (nanoBalance < conversion.nanoAmount) {
        return res.status(400).json({
          success: false,
          error: "Insufficient Nano balance",
          required: conversion.nanoAmount,
          available: nanoBalance
        });
      }

      logger.info("Processing Nano payment", { userId, amount: conversion.nanoAmount });

      let subscription = await UserSubscription.findOne({ userId });

      if (subscription) {
        subscription.plan = planId;
        subscription.status = "active";
        subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await subscription.save();
      } else {
        await UserSubscription.create({
          userId,
          plan: planId,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      }

      await User.findByIdAndUpdate(userId, { 
        subscriptionPlan: planId,
        "balance.balanceNano": Math.max(0, nanoBalance - conversion.nanoAmount)
      });

      res.json({
        success: true,
        payment: {
          method: "nano",
          amount: conversion.nanoAmount,
          currency: "XNO",
          convertedFrom: conversion.fiatAmount,
          savings: calculateSavings(plan.fiatPrice).savings
        },
        subscription: {
          plan: planId,
          status: "active",
          nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } else {
      res.json({
        success: true,
        payment: {
          method: "fiat",
          amount: plan.fiatPrice,
          currency: "EUR",
          status: "pending",
          instructions: "Payment gateway integration required"
        }
      });
    }
  } catch (err) {
    logger.error("Payment processing error", { error: err.message });
    res.status(500).json({ success: false, error: "Payment failed" });
  }
}

export async function getPaymentMethods(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();

    const nanoBalance = parseFloat(user?.balance?.balanceNano || "0");
    const rates = await getCurrentRates();

    res.json({
      success: true,
      paymentMethods: [
        {
          id: "fiat",
          name: "Credit/Debit Card",
          icon: "💳",
          fees: "2.9% + €0.25",
          estimatedFee: 0.029,
          available: true
        },
        {
          id: "xno",
          name: "Nano (XNO)",
          icon: "⚡",
          fees: "0%",
          estimatedFee: 0,
          balance: nanoBalance,
          conversionRate: rates.EUR,
          available: true,
          recommended: nanoBalance > 0
        },
        {
          id: "bank",
          name: "Bank Transfer",
          icon: "🏦",
          fees: "€1.50",
          estimatedFee: 1.50,
          available: false,
          comingSoon: true
        }
      ],
      rates
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch payment methods" });
  }
}

export async function getBillingHistory(req, res) {
  try {
    const userId = req.user._id;
    const subscriptions = await UserSubscription.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();

    res.json({
      success: true,
      billingHistory: subscriptions.map(sub => ({
        id: sub._id,
        plan: sub.plan,
        status: sub.status,
        amount: "Subscription payment",
        paymentMethod: "nano",
        date: sub.createdAt,
        nextBilling: sub.currentPeriodEnd
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch billing history" });
  }
}

export async function cancelSubscription(req, res) {
  try {
    const userId = req.user._id;
    const subscription = await UserSubscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({ success: false, error: "No subscription found" });
    }

    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.willCancelAt = subscription.currentPeriodEnd;
    await subscription.save();

    res.json({
      success: true,
      message: "Subscription cancelled",
      activeUntil: subscription.currentPeriodEnd
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to cancel subscription" });
  }
}

export async function getPaymentAnalytics(req, res) {
  try {
    const userId = req.user._id;
    
    const subscriptions = await UserSubscription.find({ userId }).lean();
    
    const stats = {
      totalSpent: subscriptions.length * 24.99,
      paymentsWithNano: subscriptions.length,
      savingsFromNano: subscriptions.length * (24.99 * 0.029),
      lastPayment: subscriptions[0]?.createdAt,
      nextPayment: subscriptions[0]?.currentPeriodEnd
    };

    const rates = await getCurrentRates();

    res.json({
      success: true,
      analytics: {
        ...stats,
        conversionRates: rates,
        savingsPercentage: 2.9
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
}

export async function pauseSubscription(req, res) {
  try {
    const userId = req.user._id;
    const { reason = "user_request" } = req.body;

    const subscription = await pauseSubscriptionService(userId, reason);

    res.json({
      success: true,
      message: "Subscription paused",
      pausedAt: subscription.pausedAt,
      resumeAt: subscription.currentPeriodEnd
    });
  } catch (err) {
    logger.error("Pause subscription error", { error: err.message });
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function resumeSubscription(req, res) {
  try {
    const userId = req.user._id;

    const subscription = await resumeSubscriptionService(userId);

    res.json({
      success: true,
      message: "Subscription resumed",
      currentPeriodEnd: subscription.currentPeriodEnd
    });
  } catch (err) {
    logger.error("Resume subscription error", { error: err.message });
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function changePlanWithProration(req, res) {
  try {
    const userId = req.user._id;
    const { newPlanId, paymentMethod = "nano" } = req.body;

    if (!PLANS_CONFIG[newPlanId]) {
      return res.status(400).json({ success: false, error: "Invalid plan" });
    }

    const subscription = await UserSubscription.findOne({ userId });
    const currentPlan = subscription?.plan || "free_trial";

    const isUpgrade = PLANS_CONFIG[newPlanId].price > (PLANS_CONFIG[currentPlan]?.price || 0);

    let result;
    if (isUpgrade) {
      result = await upgradePlanService(userId, newPlanId, paymentMethod);
    } else {
      result = await downgradePlanService(userId, newPlanId);
    }

    res.json({
      success: true,
      message: isUpgrade ? `Upgraded to ${PLANS_CONFIG[newPlanId].name}` : `Downgraded to ${PLANS_CONFIG[newPlanId].name}`,
      proration: result.proration,
      newPlan: newPlanId
    });
  } catch (err) {
    logger.error("Plan change with proration error", { error: err.message });
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getSubscriptionAnalytics(req, res) {
  try {
    const userId = req.user._id;
    const analytics = await getSubscriptionAnalyticsService(userId);

    res.json({ success: true, analytics });
  } catch (err) {
    logger.error("Subscription analytics error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
}

export async function getAIRecommendations(req, res) {
  try {
    const userId = req.user._id;
    const recommendations = await getRecommendations(userId);

    const enrichedRecommendations = recommendations.recommendations.map(rec => ({
      ...rec,
      finaMessage: generateFinaMessage(rec)
    }));

    res.json({
      success: true,
      recommendations: enrichedRecommendations,
      currentPlan: recommendations.currentPlan,
      behavior: {
        transactionCount: recommendations.behavior.transactionCount,
        fxVolume: recommendations.behavior.fxVolume,
        aiChatCount: recommendations.behavior.aiChatCount,
        growthRate: recommendations.behavior.growthRate
      }
    });
  } catch (err) {
    logger.error("AI recommendations error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to generate recommendations" });
  }
}

export async function getPlanComparison(req, res) {
  try {
    const userId = req.user._id;
    const { plans = "edge,prime,apex" } = req.query;
    const planIds = plans.split(",");

    const comparison = await getPlanComparison(userId, planIds);

    res.json({ success: true, comparison });
  } catch (err) {
    logger.error("Plan comparison error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to get plan comparison" });
  }
}

export async function getRenewalReminder(req, res) {
  try {
    const userId = req.user._id;
    const reminder = await getRenewalReminder(userId);

    res.json({ success: true, reminder });
  } catch (err) {
    logger.error("Renewal reminder error", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to get reminder" });
  }
}

export default {
  getPricingPlans,
  createCheckoutSession,
  processPayment,
  getPaymentMethods,
  getBillingHistory,
  cancelSubscription,
  getPaymentAnalytics,
  pauseSubscription,
  resumeSubscription,
  changePlanWithProration,
  getSubscriptionAnalytics,
  getAIRecommendations,
  getPlanComparison,
  getRenewalReminder
};