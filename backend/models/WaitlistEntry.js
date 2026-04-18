const mongoose = require("mongoose");

const WaitlistEntrySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      immutable: true
    }
  },
  { timestamps: false }
);

module.exports = mongoose.model("WaitlistEntry", WaitlistEntrySchema);
