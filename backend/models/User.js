const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    password: { type: String, required: true, select: false },
    walletAddress: { type: String, default: null },

    // Internal Nano node wallet id for signing/sending (not exposed)
    walletId: { type: String, default: null, select: false }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = mongoose.model("User", UserSchema);

