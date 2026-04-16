const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountRaw: { type: String, required: true }, // raw units (as string)
    amountNano: { type: String, required: true }, // user-friendly (as string)
    txHash: { type: String, default: null, index: true },
    senderAddress: { type: String, required: true },
    receiverAddress: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "submitted", "confirmed", "failed"],
      default: "pending",
      index: true
    },
    errorMessage: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    timestamp: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: false }
);

module.exports = mongoose.model("Transaction", TransactionSchema);

