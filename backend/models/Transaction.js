const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountRaw: { type: String, required: true }, // raw units (as string)
    amountNano: { type: String, required: true }, // user-friendly (as string)
    txHash: { type: String, required: true, index: true },
    timestamp: { type: Date, default: () => new Date() }
  },
  { timestamps: false }
);

module.exports = mongoose.model("Transaction", TransactionSchema);

