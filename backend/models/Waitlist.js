import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  joinedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Waitlist", waitlistSchema);
