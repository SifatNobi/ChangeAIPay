import mongoose from "mongoose";

const WalletJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "success", "failed"],
    default: "pending",
    index: true
  },
  retries: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 5
  },
  nextRunAt: {
    type: Date,
    default: Date.now
  },
  lastError: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

WalletJobSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("WalletJob", WalletJobSchema);
