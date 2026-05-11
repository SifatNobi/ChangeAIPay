import mongoose from "mongoose";

const merchantSubscriptionSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  tier: {
    type: String,
    enum: ["startup", "growth", "scale", "premium", "retention", "enterprise"],
    default: "startup"
  },
  status: {
    type: String,
    enum: ["active", "cancelled", "downgraded", "upgraded", "suspended"],
    default: "active"
  },
  revenueTier: {
    type: String,
    enum: ["startup", "growth", "scale", "premium", "retention", "enterprise"],
    default: "startup"
  },
  annualRevenue: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: Date,
  features: {
    aiRevenueBooster: { type: Boolean, default: false },
    cashFlowPredictor: { type: Boolean, default: false },
    smartTranscripts: { type: Boolean, default: false },
    moneyMonitoring: { type: Boolean, default: false },
    analyticsDashboard: { type: Boolean, default: false },
    autoPersonalizedMarketing: { type: Boolean, default: false },
    aiUpsellAssistant: { type: Boolean, default: false },
    pricingSuggestions: { type: Boolean, default: false },
    customerReengagement: { type: Boolean, default: false },
    smartPricingEngine: { type: Boolean, default: false },
    customerLifetimeValue: { type: Boolean, default: false },
    businessHealthDashboard: { type: Boolean, default: false },
    strongerCashFlowPredictor: { type: Boolean, default: false },
    aiCustomerRecovery: { type: Boolean, default: false },
    dynamicDemandPricing: { type: Boolean, default: false },
    advancedChurnPrevention: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    premiumAnalytics: { type: Boolean, default: false },
    retentionCampaigns: { type: Boolean, default: false },
    profitabilityOptimization: { type: Boolean, default: false },
    aiCallHandling: { type: Boolean, default: false },
    aiMessaging: { type: Boolean, default: false },
    customAIWorkflows: { type: Boolean, default: false },
    enterpriseInfrastructure: { type: Boolean, default: false },
    fraudIntelligenceModels: { type: Boolean, default: false },
    apiCustomization: { type: Boolean, default: false },
    privateRoutingLogic: { type: Boolean, default: false },
    strategicAccountManagement: { type: Boolean, default: false }
  },
  pricing: {
    platformFee: { type: Number, default: 1.25 },
    fxSpread: { type: Number, default: 1.0 },
    feeCap: { type: Number, default: null }
  },
  analytics: {
    totalRevenue: { type: Number, default: 0 },
    monthlyRevenue: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    customerCount: { type: Number, default: 0 },
    churnRate: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    lastUpdated: Date
  },
  earlyWarningAlerts: [{
    type: String,
    message: String,
    severity: { type: String, enum: ["low", "medium", "high"] },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

merchantSubscriptionSchema.index({ tier: 1, status: 1 });
merchantSubscriptionSchema.index({ revenueTier: 1 });

export default mongoose.model("MerchantSubscription", merchantSubscriptionSchema);