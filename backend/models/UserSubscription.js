import mongoose from "mongoose";

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  plan: {
    type: String,
    enum: ["free_trial", "edge", "prime", "apex"],
    default: "free_trial"
  },
  status: {
    type: String,
    enum: ["active", "cancelled", "expired", "paused", "past_due"],
    default: "active"
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
  cancelledAt: Date,
  willCancelAt: Date,
  usage: {
    fxUsedThisMonth: { type: Number, default: 0 },
    aiChatsThisMonth: { type: Number, default: 0 },
    transactionsThisMonth: { type: Number, default: 0 },
    amountSentThisMonth: { type: Number, default: 0 }
  },
  features: {
    aiAssistant: { type: Boolean, default: true },
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
    bookingPayWorkflows: { type: Boolean, default: false }
  },
  settings: {
    autoRenew: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true },
    budgetAlerts: { type: Boolean, default: true }
  },
  metadata: {
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    paymentMethod: String
  }
}, {
  timestamps: true
});

userSubscriptionSchema.index({ status: 1, plan: 1 });
userSubscriptionSchema.index({ "usage.fxUsedThisMonth": 1 });

export default mongoose.model("UserSubscription", userSubscriptionSchema);