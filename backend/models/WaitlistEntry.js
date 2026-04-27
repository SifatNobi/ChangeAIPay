import mongoose from "mongoose";

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

export default mongoose.model("WaitlistEntry", WaitlistEntrySchema);
