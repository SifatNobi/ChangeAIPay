const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { createWalletAndAccount } = require("../services/nano");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign({}, secret, { subject: String(userId), expiresIn: "7d" });
}

async function register(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) return res.status(400).json({ error: "Name is required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Valid email required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });

    // Create real Nano wallet/account for this user (no mock logic)
    try {
      const { walletId, address } = await createWalletAndAccount();
      user.walletId = walletId;
      user.walletAddress = address;
      await user.save();
    } catch (err) {
      await User.deleteOne({ _id: user._id });
      return res.status(502).json({
        error: "Failed to create Nano wallet via RPC",
        details: String(err?.message || err)
      });
    }

    const token = signToken(user._id);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, walletAddress: user.walletAddress, createdAt: user.createdAt }
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Valid email required" });
    if (!password) return res.status(400).json({ error: "Password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user._id);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, walletAddress: user.walletAddress, createdAt: user.createdAt }
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

module.exports = { register, login };

