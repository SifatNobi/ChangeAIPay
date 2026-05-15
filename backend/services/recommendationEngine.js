import User from "../models/User.js";
import UserSubscription from "../models/UserSubscription.js";
import Transaction from "../models/Transaction.js";
import { getCurrentRates, convertFiatToNano } from "./conversionService.js";
import logger from "./logger.js";

const PLANS_CONFIG = {
  free_trial: {
    name: "Free Trial",
    price: 0,
    fxFee: 1.45,
    fxFreeAmount: 0,
    features: []
  },
  edge: {
    name: "Edge",
    price: 19.99,
    fxFee: 0.95,
    fxFreeAmount: 1000,
    features: ["Fraud Protection", "Smart Routing", "Predictive Reminders", "Spending Alerts"],
    tagline: "Full AI Assistant"
  },
  prime: {
    name: "Prime",
    price: 29.99,
    fxFee: 0.72,
    fxFreeAmount: 3000,
    features: ["AI Financial Autopilot", "Smart Undo Payments", "Social Payments Brain", "Advanced Fraud Detection", "Dynamic Budget"],
    tagline: "AI Financial Autopilot",
    popular: true
  },
  apex: {
    name: "Apex",
    price: 49.99,
    fxFee: 0.58,
    fxFreeAmount: 6000,
    features: ["Autonomous AI Payments", "AI Negotiator", "Life Event Mode", "Priority Routing", "Booking Workflows"],
    tagline: "Ultimate AI Automation",
    legendary: true
  }
};

class RecommendationEngine {
  constructor() {
    this.recommendationCooldown = 7 * 24 * 60 * 60 * 1000;
  }

  async analyzeUserBehavior(userId) {
    const user = await User.findById(userId);
    const subscription = await UserSubscription.findOne({ userId });
    const transactions = await Transaction.find({
      userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    
    const lastMonthTransactions = await Transaction.countDocuments({
      userId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const prevMonthTransactions = await Transaction.countDocuments({
      userId,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });

    const totalVolume = transactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const fxVolume = transactions.reduce((sum, t) => sum + Math.abs(t.fxAmount || 0), 0);
    const avgTransactionSize = transactions.length > 0 ? totalVolume / transactions.length : 0;
    
    const nanoTransactions = transactions.filter(t => t.currency === "XNO" || t.cryptoAmount).length;
    const fiatTransactions = transactions.length - nanoTransactions;
    
    const growthRate = prevMonthTransactions > 0 
      ? ((lastMonthTransactions - prevMonthTransactions) / prevMonthTransactions) * 100 
      : lastMonthTransactions > 0 ? 100 : 0;

    const aiChatCount = subscription?.usage?.aiChatsThisMonth || 0;
    const fxUsage = subscription?.usage?.fxUsedThisMonth || 0;

    return {
      userId,
      currentPlan: subscription?.plan || "free_trial",
      transactionCount: transactions.length,
      lastMonthTransactions,
      growthRate,
      totalVolume,
      fxVolume,
      avgTransactionSize,
      nanoUsage: (nanoTransactions / transactions.length) * 100 || 0,
      aiChatCount,
      fxUsage,
      daysUntilRenewal: subscription?.currentPeriodEnd 
        ? Math.ceil((subscription.currentPeriodEnd - new Date()) / (24 * 60 * 60 * 1000))
        : 30,
      autoRenew: subscription?.settings?.autoRenew ?? true,
      status: subscription?.status || "none"
    };
  }

  async calculateUpgradeBenefits(userId, fromPlan, toPlan) {
    const behavior = await this.analyzeUserBehavior(userId);
    
    const fromConfig = PLANS_CONFIG[fromPlan];
    const toConfig = PLANS_CONFIG[toPlan];

    if (!fromConfig || !toConfig) return null;

    const savingsFromFX = behavior.fxVolume > fromConfig.fxFreeAmount
      ? (behavior.fxVolume - Math.max(fromConfig.fxFreeAmount, toConfig.fxFreeAmount)) * (fromConfig.fxFee - toConfig.fxFee) / 100
      : behavior.fxVolume > toConfig.fxFreeAmount
        ? (behavior.fxVolume - toConfig.fxFreeAmount) * toConfig.fxFee / 100
        : 0;

    const priceDifference = toConfig.price - fromConfig.price;
    const netSavings = savingsFromFX - priceDifference;

    return {
      priceDifference: Math.round(priceDifference * 100) / 100,
      fxSavings: Math.round(savingsFromFX * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      fxFeeReduction: fromConfig.fxFee - toConfig.fxFee,
      fxFreeIncrease: toConfig.fxFreeAmount - fromConfig.fxFreeAmount,
      newFeatures: toConfig.features.filter(f => !fromConfig.features.includes(f))
    };
  }

  async getRecommendations(userId, forceRefresh = false) {
    const behavior = await this.analyzeUserBehavior(userId);
    const currentPlan = behavior.currentPlan;
    
    const recommendations = [];
    const currentConfig = PLANS_CONFIG[currentPlan];

    if (currentPlan === "free_trial") {
      const edgeBenefits = await this.calculateUpgradeBenefits(userId, "free_trial", "edge");
      const primeBenefits = await this.calculateUpgradeBenefits(userId, "free_trial", "prime");
      const apexBenefits = await this.calculateUpgradeBenefits(userId, "free_trial", "apex");

      if (behavior.transactionCount > 5 || behavior.aiChatCount > 20) {
        recommendations.push({
          type: "upgrade",
          recommendedPlan: "edge",
          confidence: "high",
          reasoning: [
            `You've made ${behavior.transactionCount} transactions this month`,
            `You're using AI features frequently (${behavior.aiChatCount} chats)`,
            `Upgrade to Edge to get fraud protection and smart routing`
          ],
          benefits: edgeBenefits,
          premium: false,
          callToAction: "Start your journey with Edge"
        });
      }

      if (behavior.fxVolume > 500) {
        recommendations.push({
          type: "upgrade",
          recommendedPlan: "prime",
          confidence: behavior.fxVolume > 2000 ? "high" : "medium",
          reasoning: [
            `High foreign exchange volume: €${behavior.fxVolume.toFixed(2)}`,
            `You're paying ${currentConfig.fxFee}% FX fees`,
            `Prime would reduce your FX fees to ${PLANS_CONFIG.prime.fxFee}%`
          ],
          benefits: primeBenefits,
          premium: true,
          callToAction: "Reduce your FX costs significantly"
        });
      }
    }

    if (currentPlan === "edge") {
      const primeBenefits = await this.calculateUpgradeBenefits(userId, "edge", "prime");
      const apexBenefits = await this.calculateUpgradeBenefits(userId, "edge", "apex");

      if (behavior.fxVolume > PLANS_CONFIG.edge.fxFreeAmount) {
        const potentialSavings = (behavior.fxVolume - PLANS_CONFIG.edge.fxFreeAmount) * 0.23 / 100;
        recommendations.push({
          type: "upgrade",
          recommendedPlan: "prime",
          confidence: "high",
          reasoning: [
            `Your FX usage (€${behavior.fxVolume.toFixed(2)}) exceeds Edge's free limit (€1,000)`,
            `You're paying ${PLANS_CONFIG.edge.fxFee}% on over-limit transactions`,
            `Prime would save you approximately €${potentialSavings.toFixed(2)}/month in FX fees`
          ],
          benefits: primeBenefits,
          premium: true,
          callToAction: "Stop overpaying on foreign transactions"
        });
      }

      if (behavior.aiChatCount > 100 || behavior.transactionCount > 20) {
        recommendations.push({
          type: "upgrade",
          recommendedPlan: "apex",
          confidence: "medium",
          reasoning: [
            `You're a power user with ${behavior.aiChatCount} AI chats this month`,
            `${behavior.transactionCount} transactions shows high activity`,
            `Apex unlocks autonomous AI payments and AI Negotiator`
          ],
          benefits: apexBenefits,
          legendary: true,
          callToAction: "Unlock the ultimate AI automation experience"
        });
      }
    }

    if (currentPlan === "prime") {
      const apexBenefits = await this.calculateUpgradeBenefits(userId, "prime", "apex");

      if (behavior.aiChatCount > 200 || behavior.transactionCount > 30) {
        recommendations.push({
          type: "legendary",
          recommendedPlan: "apex",
          confidence: "high",
          reasoning: [
            `You're on track for power user status with ${behavior.aiChatCount} AI chats`,
            `Prime is great, but Apex is built for your usage level`,
            `Apex includes AI Negotiator which can save you money on purchases`
          ],
          benefits: apexBenefits,
          legendary: true,
          legendaryTitle: "Legendary Choice",
          callToAction: "Experience the most powerful AI automation available"
        });
      }

      if (behavior.growthRate > 20) {
        recommendations.push({
          type: "upgrade",
          recommendedPlan: "apex",
          confidence: "medium",
          reasoning: [
            `Your transaction growth is ${behavior.growthRate.toFixed(1)}% month-over-month`,
            `Apex is designed for growing needs`,
            `Get priority routing and booking workflows to support your growth`
          ],
          benefits: apexBenefits,
          legendary: true,
          callToAction: "Scale with the best"
        });
      }
    }

    if (behavior.fxVolume > PLANS_CONFIG[currentPlan].fxFreeAmount) {
      recommendations.push({
        type: "fee_optimization",
        recommendedPlan: currentPlan,
        confidence: "high",
        reasoning: [
          `You've used €${behavior.fxVolume.toFixed(2)} in foreign transactions`,
          `Only €${PLANS_CONFIG[currentPlan].fxFreeAmount} is fee-free`,
          `Consider upgrading to reduce per-transaction FX fees`
        ],
        savings: {
          currentFees: Math.round(behavior.fxVolume * PLANS_CONFIG[currentPlan].fxFee / 100 * 100) / 100,
          potentialSavings: Math.round(behavior.fxVolume * 0.5 / 100 * 100) / 100
        },
        callToAction: "Optimize your FX costs"
      });
    }

    const canUseNano = parseFloat((await User.findById(userId))?.balance?.balanceNano || "0") > 0;
    if (canUseNano && behavior.transactionCount > 0) {
      const conversion = await convertFiatToNano(behavior.totalVolume, "EUR");
      recommendations.push({
        type: "payment_tip",
        recommendedPlan: currentPlan,
        confidence: "high",
        reasoning: [
          `You have Nano in your wallet`,
          `Paying with Nano saves 2.9% in processing fees`,
          `On your €${behavior.totalVolume.toFixed(2)} monthly volume, that's ~€${(behavior.totalVolume * 0.029).toFixed(2)} savings`
        ],
        callToAction: "Switch to Nano for instant, fee-free payments"
      });
    }

    recommendations.sort((a, b) => {
      const priority = { legendary: 0, upgrade: 1, fee_optimization: 2, payment_tip: 3 };
      return priority[a.type] - priority[b.type];
    });

    return {
      userId,
      currentPlan: {
        id: currentPlan,
        name: currentConfig.name,
        price: currentConfig.price,
        fxFee: currentConfig.fxFee,
        fxFreeAmount: currentConfig.fxFreeAmount
      },
      behavior,
      recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  async getPlanComparison(userId, planIds = ["edge", "prime", "apex"]) {
    const behavior = await this.analyzeUserBehavior(userId);
    const comparison = [];

    for (const planId of planIds) {
      const plan = PLANS_CONFIG[planId];
      const benefits = await this.calculateUpgradeBenefits(userId, behavior.currentPlan, planId);
      
      comparison.push({
        id: planId,
        name: plan.name,
        price: plan.price,
        fxFee: plan.fxFee,
        fxFreeAmount: plan.fxFreeAmount,
        features: plan.features,
        tagline: plan.tagline,
        isPopular: plan.popular,
        isLegendary: plan.legendary,
        benefits: benefits || {},
        recommended: planId === "apex" && behavior.aiChatCount > 100
      });
    }

    return {
      currentPlan: behavior.currentPlan,
      plans: comparison,
      fxUsage: behavior.fxVolume,
      aiChatUsage: behavior.aiChatCount
    };
  }

  generateFinaRecommendationMessage(recommendation) {
    const { type, recommendedPlan, reasoning, callToAction, legendary, legendaryTitle } = recommendation;
    const plan = PLANS_CONFIG[recommendedPlan];

    let message = "";

    if (type === "legendary" || legendary) {
      message = `🏆 ${legendaryTitle || "Legendary Choice"}: ${plan.name}\n\n`;
    } else if (type === "upgrade") {
      message = `✨ Upgrade to ${plan.name}\n\n`;
    } else if (type === "fee_optimization") {
      message = `💡 Optimize Your Fees\n\n`;
    } else if (type === "payment_tip") {
      message = `⚡ Save with Nano\n\n`;
    }

    message += reasoning.map(r => `• ${r}`).join("\n");
    message += `\n\n💬 ${callToAction}`;

    return message;
  }

  async getRenewalReminder(userId) {
    const behavior = await this.analyzeUserBehavior(userId);
    
    if (behavior.daysUntilRenewal <= 7 && behavior.daysUntilRenewal > 0) {
      const daysLeft = behavior.daysUntilRenewal;
      const plan = PLANS_CONFIG[behavior.currentPlan];
      
      return {
        type: "renewal_reminder",
        daysUntilRenewal: daysLeft,
        currentPlan: plan.name,
        message: `Your ${plan.name} subscription renews in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.`,
        showUpgradeOption: plan.name !== "Apex",
        recommendedUpgrade: behavior.currentPlan === "prime" ? "apex" : 
                            behavior.currentPlan === "edge" ? "prime" : null
      };
    }

    return null;
  }
}

const recommendationEngine = new RecommendationEngine();

export const getRecommendations = (userId, force) => 
  recommendationEngine.getRecommendations(userId, force);
export const getPlanComparison = (userId, plans) => 
  recommendationEngine.getPlanComparison(userId, plans);
export const analyzeUserBehavior = (userId) => 
  recommendationEngine.analyzeUserBehavior(userId);
export const calculateUpgradeBenefits = (userId, from, to) => 
  recommendationEngine.calculateUpgradeBenefits(userId, from, to);
export const getRenewalReminder = (userId) => 
  recommendationEngine.getRenewalReminder(userId);
export const generateFinaMessage = (rec) => 
  recommendationEngine.generateFinaRecommendationMessage(rec);
export { PLANS_CONFIG };

export default recommendationEngine;