import MerchantSubscription from "../models/MerchantSubscription.js";
import User from "../models/User.js";

const MERCHANT_TIERS = {
  startup: {
    name: "Startup",
    revenueRange: { min: 0, max: 10000 },
    description: "AI Revenue Booster, Basic Cash Flow Predictor",
    pricing: { platformFee: 1.25, fxSpread: 1.0, feeCap: null },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: false,
      aiUpsellAssistant: false,
      pricingSuggestions: false,
      customerReengagement: false,
      smartPricingEngine: false,
      customerLifetimeValue: false,
      businessHealthDashboard: false,
      strongerCashFlowPredictor: false,
      aiCustomerRecovery: false,
      dynamicDemandPricing: false,
      advancedChurnPrevention: false,
      prioritySupport: false,
      premiumAnalytics: false,
      retentionCampaigns: false,
      profitabilityOptimization: false,
      aiCallHandling: false,
      aiMessaging: false,
      customAIWorkflows: false,
      enterpriseInfrastructure: false,
      fraudIntelligenceModels: false,
      apiCustomization: false,
      privateRoutingLogic: false,
      strategicAccountManagement: false
    }
  },
  growth: {
    name: "Growth",
    revenueRange: { min: 10000, max: 50000 },
    description: "Auto-Personalized Marketing, AI Upsell Assistant",
    pricing: { platformFee: 1.75, fxSpread: 0.85, feeCap: null },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: true,
      aiUpsellAssistant: true,
      pricingSuggestions: true,
      customerReengagement: true,
      smartPricingEngine: false,
      customerLifetimeValue: false,
      businessHealthDashboard: false,
      strongerCashFlowPredictor: false,
      aiCustomerRecovery: false,
      dynamicDemandPricing: false,
      advancedChurnPrevention: false,
      prioritySupport: false,
      premiumAnalytics: false,
      retentionCampaigns: false,
      profitabilityOptimization: false,
      aiCallHandling: false,
      aiMessaging: false,
      customAIWorkflows: false,
      enterpriseInfrastructure: false,
      fraudIntelligenceModels: false,
      apiCustomization: false,
      privateRoutingLogic: false,
      strategicAccountManagement: false
    }
  },
  scale: {
    name: "Scale",
    revenueRange: { min: 50000, max: 100000 },
    description: "Smart Pricing Engine, Customer Lifetime Value",
    pricing: { platformFee: 2.25, fxSpread: 0.7, feeCap: null },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: true,
      aiUpsellAssistant: true,
      pricingSuggestions: true,
      customerReengagement: true,
      smartPricingEngine: true,
      customerLifetimeValue: true,
      businessHealthDashboard: true,
      strongerCashFlowPredictor: true,
      aiCustomerRecovery: false,
      dynamicDemandPricing: false,
      advancedChurnPrevention: false,
      prioritySupport: false,
      premiumAnalytics: false,
      retentionCampaigns: false,
      profitabilityOptimization: false,
      aiCallHandling: false,
      aiMessaging: false,
      customAIWorkflows: false,
      enterpriseInfrastructure: false,
      fraudIntelligenceModels: false,
      apiCustomization: false,
      privateRoutingLogic: false,
      strategicAccountManagement: false
    }
  },
  premium: {
    name: "Premium",
    revenueRange: { min: 100000, max: 400000 },
    description: "AI Customer Recovery, Dynamic demand pricing",
    pricing: { platformFee: 2.75, fxSpread: 0.6, feeCap: 500 },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: true,
      aiUpsellAssistant: true,
      pricingSuggestions: true,
      customerReengagement: true,
      smartPricingEngine: true,
      customerLifetimeValue: true,
      businessHealthDashboard: true,
      strongerCashFlowPredictor: true,
      aiCustomerRecovery: true,
      dynamicDemandPricing: true,
      advancedChurnPrevention: true,
      prioritySupport: true,
      premiumAnalytics: true,
      retentionCampaigns: false,
      profitabilityOptimization: false,
      aiCallHandling: false,
      aiMessaging: false,
      customAIWorkflows: false,
      enterpriseInfrastructure: false,
      fraudIntelligenceModels: false,
      apiCustomization: false,
      privateRoutingLogic: false,
      strategicAccountManagement: false
    }
  },
  retention: {
    name: "Retention",
    revenueRange: { min: 400000, max: 500000 },
    description: "Retention-focused AI campaigns, Profitability optimization",
    pricing: { platformFee: 2.35, fxSpread: 0.5, feeCap: 450 },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: true,
      aiUpsellAssistant: true,
      pricingSuggestions: true,
      customerReengagement: true,
      smartPricingEngine: true,
      customerLifetimeValue: true,
      businessHealthDashboard: true,
      strongerCashFlowPredictor: true,
      aiCustomerRecovery: true,
      dynamicDemandPricing: true,
      advancedChurnPrevention: true,
      prioritySupport: true,
      premiumAnalytics: true,
      retentionCampaigns: true,
      profitabilityOptimization: true,
      aiCallHandling: false,
      aiMessaging: false,
      customAIWorkflows: false,
      enterpriseInfrastructure: false,
      fraudIntelligenceModels: false,
      apiCustomization: false,
      privateRoutingLogic: false,
      strategicAccountManagement: false
    }
  },
  enterprise: {
    name: "Enterprise",
    revenueRange: { min: 500000, max: Infinity },
    description: "AI call handling, Custom workflows, API customization",
    pricing: { platformFee: 2.2, fxSpread: 0.45, feeCap: 400 },
    features: {
      aiRevenueBooster: true,
      cashFlowPredictor: true,
      smartTranscripts: true,
      moneyMonitoring: true,
      analyticsDashboard: true,
      autoPersonalizedMarketing: true,
      aiUpsellAssistant: true,
      pricingSuggestions: true,
      customerReengagement: true,
      smartPricingEngine: true,
      customerLifetimeValue: true,
      businessHealthDashboard: true,
      strongerCashFlowPredictor: true,
      aiCustomerRecovery: true,
      dynamicDemandPricing: true,
      advancedChurnPrevention: true,
      prioritySupport: true,
      premiumAnalytics: true,
      retentionCampaigns: true,
      profitabilityOptimization: true,
      aiCallHandling: true,
      aiMessaging: true,
      customAIWorkflows: true,
      enterpriseInfrastructure: true,
      fraudIntelligenceModels: true,
      apiCustomization: true,
      privateRoutingLogic: true,
      strategicAccountManagement: true
    }
  }
};

function determineTier(annualRevenue) {
  if (annualRevenue >= 500000) return "enterprise";
  if (annualRevenue >= 400000) return "retention";
  if (annualRevenue >= 100000) return "premium";
  if (annualRevenue >= 50000) return "scale";
  if (annualRevenue >= 10000) return "growth";
  return "startup";
}

export async function getMerchantPlans(req, res) {
  try {
    const plans = Object.entries(MERCHANT_TIERS).map(([key, tier]) => ({
      id: key,
      name: tier.name,
      description: tier.description,
      revenueRange: tier.revenueRange,
      pricing: tier.pricing,
      features: Object.entries(tier.features)
        .filter(([_, included]) => included)
        .map(([name]) => formatFeatureName(name)),
      isPopular: key === "scale"
    }));

    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch plans" });
  }
}

export async function getCurrentMerchantSubscription(req, res) {
  try {
    const merchantId = req.user._id;
    
    if (req.user.role !== "merchant" && req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Merchant only" });
    }

    let subscription = await MerchantSubscription.findOne({ merchantId });
    
    if (!subscription) {
      const tier = determineTier(0);
      const tierConfig = MERCHANT_TIERS[tier];
      
      subscription = await MerchantSubscription.create({
        merchantId,
        tier,
        revenueTier: tier,
        status: "active",
        features: tierConfig.features,
        pricing: tierConfig.pricing,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    const tierConfig = MERCHANT_TIERS[subscription.tier];

    res.json({
      success: true,
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        annualRevenue: subscription.annualRevenue,
        features: subscription.features,
        pricing: subscription.pricing,
        analytics: subscription.analytics,
        earlyWarningAlerts: subscription.earlyWarningAlerts,
        planDetails: tierConfig
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch subscription" });
  }
}

export async function updateRevenueTier(req, res) {
  try {
    const merchantId = req.user._id;
    const { annualRevenue } = req.body;

    const newTier = determineTier(annualRevenue);
    const tierConfig = MERCHANT_TIERS[newTier];

    let subscription = await MerchantSubscription.findOne({ merchantId });

    if (subscription) {
      subscription.annualRevenue = annualRevenue;
      subscription.revenueTier = newTier;
      subscription.tier = newTier;
      subscription.features = tierConfig.features;
      subscription.pricing = tierConfig.pricing;
      await subscription.save();
    } else {
      subscription = await MerchantSubscription.create({
        merchantId,
        tier: newTier,
        revenueTier: newTier,
        annualRevenue,
        features: tierConfig.features,
        pricing: tierConfig.pricing,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    res.json({
      success: true,
      message: `Tier updated to ${tierConfig.name}`,
      tier: newTier,
      pricing: tierConfig.pricing
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update tier" });
  }
}

export async function getMerchantAnalytics(req, res) {
  try {
    const merchantId = req.user._id;
    const subscription = await MerchantSubscription.findOne({ merchantId });

    if (!subscription) {
      return res.json({
        success: true,
        analytics: null,
        alerts: []
      });
    }

    res.json({
      success: true,
      analytics: subscription.analytics,
      alerts: subscription.earlyWarningAlerts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
}

export async function updateMerchantAnalytics(req, res) {
  try {
    const merchantId = req.user._id;
    const { totalRevenue, monthlyRevenue, transactionCount, customerCount } = req.body;

    const subscription = await MerchantSubscription.findOne({ merchantId });

    if (subscription) {
      subscription.analytics = {
        totalRevenue: totalRevenue || subscription.analytics.totalRevenue,
        monthlyRevenue: monthlyRevenue || subscription.analytics.monthlyRevenue,
        transactionCount: transactionCount || subscription.analytics.transactionCount,
        customerCount: customerCount || subscription.analytics.customerCount,
        lastUpdated: new Date()
      };
      await subscription.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update analytics" });
  }
}

export async function getCashFlowPrediction(req, res) {
  try {
    const merchantId = req.user._id;
    const subscription = await MerchantSubscription.findOne({ merchantId });

    const hasFeature = subscription?.features?.cashFlowPredictor || 
                       subscription?.features?.strongerCashFlowPredictor;

    if (!hasFeature) {
      return res.status(403).json({ success: false, error: "Feature not available" });
    }

    const monthlyRevenue = subscription?.analytics?.monthlyRevenue || 0;
    const predictions = [];
    
    for (let i = 1; i <= 6; i++) {
      const projected = monthlyRevenue * (1 + (Math.random() * 0.2 - 0.05));
      predictions.push({
        month: i,
        projectedRevenue: Math.round(projected),
        confidence: 0.85 - (i * 0.05)
      });
    }

    res.json({
      success: true,
      predictions,
      currentMonthlyRevenue: monthlyRevenue
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get predictions" });
  }
}

export async function getLifetimeValueData(req, res) {
  try {
    const merchantId = req.user._id;
    const subscription = await MerchantSubscription.findOne({ merchantId });

    if (!subscription?.features?.customerLifetimeValue) {
      return res.status(403).json({ success: false, error: "Feature not available" });
    }

    const avgLTV = subscription?.analytics?.lifetimeValue || 250;
    const customerCount = subscription?.analytics?.customerCount || 100;

    res.json({
      success: true,
      data: {
        averageLTV: avgLTV,
        totalCustomers: customerCount,
        predictedValue: avgLTV * customerCount,
        segments: [
          { name: "High Value", count: Math.round(customerCount * 0.2), ltv: avgLTV * 2 },
          { name: "Medium Value", count: Math.round(customerCount * 0.3), ltv: avgLTV },
          { name: "Growth Potential", count: Math.round(customerCount * 0.5), ltv: avgLTV * 0.5 }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get LTV data" });
  }
}

function formatFeatureName(name) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export function hasMerchantFeature(user, feature) {
  if (!user || user.role !== "merchant") return false;
  
  const featureKey = feature.replace(/^has/, "").replace(/^is/, "");
  const configKey = feature.charAt(0).toLowerCase() + feature.slice(1);
  
  return MERCHANT_TIERS[user.merchantTier]?.features[configKey] || false;
}

export default {
  getMerchantPlans,
  getCurrentMerchantSubscription,
  updateRevenueTier,
  getMerchantAnalytics,
  updateMerchantAnalytics,
  getCashFlowPrediction,
  getLifetimeValueData,
  hasMerchantFeature,
  MERCHANT_TIERS
};