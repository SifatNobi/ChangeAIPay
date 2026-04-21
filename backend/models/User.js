const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  // 🔴 IMPORTANT FIX: hide password from queries by default
  password: {
    type: String,
    required: true,
    select: false
  },

  walletAddress: {
    type: String,
    default: ""
  },

  walletId: {
    type: String,
    default: ""
  },

  privateKey: {
    type: String,
    default: ""
  },

  walletStatus: {
    type: String,
    enum: ["pending", "active", "failed"],
    default: "pending"
  },

  walletCreatedAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * 🔐 FIXED: safe password comparison method
 * (prevents undefined crashes and keeps logic consistent)
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Optional: safer toJSON (prevents leaking password if ever selected)
 */
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.privateKey; // extra safety for wallet security
  return obj;
};

module.exports = mongoose.model("User", UserSchema);