import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ["free_trial", "edge", "prime", "apex"]
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: "USD"
  },
  billingCycle: {
    type: String,
    enum: ["monthly", "yearly", "one_time"],
    default: "monthly"
  },
  features: {
    aiAssistant: { type: Boolean, default: false },
    fraudProtection: { type: Boolean, default: false },
    smartRouting: { type: Boolean, default: false },
    predictiveReminders: { type: Boolean, default: false },
    spendingAlerts: { type: Boolean, default: false },
    aiFinancialAutopilot: { type: Boolean, default: false },
    smartUndoPayments: { type: Boolean, default: false },
    smartSocialPaymentsBrain: { type: Boolean, default: false },
    advancedFraudDetection: { type: Boolean, default: false },
    dynamicBudgetOptimization: { type: Boolean, default: false },
    aiNegotiator: { type: Boolean, default: false },
    lifeEventMode: { type: Boolean, default: false },
    prioritySmartRouting: { type: Boolean, default: false },
    bookingPayWorkflows: { type: Boolean, default: false },
    smartTranscripts: { type: Boolean, default: false },
    lowBalanceAlerts: { type: Boolean, default: false },
    spendingCoach: { type: Boolean, default: false },
    goalBasedAI: { type: Boolean, default: false }
  },
  limits: {
    fxFreeAmount: { type: Number, default: 0 },
    fxFeeAfterLimit: { type: Number, default: 1.45 },
    monthlyCap: { type: Number, default: null },
    aiChatLimit: { type: Number, default: 50 },
    transactionLimit: { type: Number, default: null }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

subscriptionPlanSchema.index({ sortOrder: 1 });

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);