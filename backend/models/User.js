const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  password: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    default: ''
  },
  // Optional internal wallet identifier (present in some flows)
  walletId: {
    type: String,
    default: ''
  },
  privateKey: {
    type: String,
    default: ''
  },
  walletStatus: {
    type: String,
    enum: ['pending', 'active', 'failed'],
    default: 'pending'
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

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
