import mongoose from "mongoose";

const WaitlistEntrySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    source: {
      type: String,
      enum: ["web", "api", "referral", "social"],
      default: "web"
    },
    referredBy: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "verified", "converted", "removed"],
      default: "pending"
    },
    notes: {
      type: String,
      maxlength: 500
    },
    metadata: {
      country: String,
      timezone: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String
    }
  },
  { timestamps: true }
);

WaitlistEntrySchema.index({ createdAt: -1 });
WaitlistEntrySchema.index({ status: 1 });

export default mongoose.model("WaitlistEntry", WaitlistEntrySchema);
