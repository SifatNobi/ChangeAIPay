import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["send", "receive", "receive_pending", "change", "receive_invalid"],
    required: true
  },
  amount: {
    type: String,
    required: true
  },
  amountRaw: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: "XNO"
  },
  direction: {
    type: String,
    enum: ["incoming", "outgoing"],
    required: true
  },
  fromAddress: {
    type: String,
    sparse: true
  },
  toAddress: {
    type: String,
    sparse: true
  },
  hash: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  representative: String,
  signature: String,
  block: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "failed", "expired"],
    default: "pending",
    index: true
  },
  confirmations: {
    type: Number,
    default: 0
  },
  metadata: {
    description: String,
    category: String,
    tags: [String],
    externalId: String,
    paymentMethod: String
  },
  fee: {
    type: String,
    default: "0"
  },
  executedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ toAddress: 1, status: 1 });
transactionSchema.index({ fromAddress: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });

transactionSchema.virtual("id").get(function() {
  return this._id.toHexString();
});

transactionSchema.virtual("amountFormatted").get(function() {
  const raw = BigInt(this.amountRaw || "0");
  const nano = raw / BigInt(1000000000000000000);
  const remainder = raw % BigInt(1000000000000000000);
  return `${nano}.${remainder.toString().padStart(18, "0").slice(0, 6)}`;
});

export default mongoose.model("Transaction", transactionSchema);