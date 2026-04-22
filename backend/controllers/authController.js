// MVP: Converted to CommonJS-friendly ES-like structure for compatibility in this patch
const User = require("../models/User.js");
const jwt = require("jsonwebtoken");
const { createWalletAndAccount } = require("../services/nano.js");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: "7d" });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    walletAddress: user.walletAddress,
    walletStatus: user.walletStatus,
    walletId: user.walletId,
    walletCreatedAt: user.walletCreatedAt,
    createdAt: user.createdAt
  };
}

async function register(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Valid email required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, walletStatus: "pending" });

    // Attempt wallet provisioning once (MVP: synchronous attempt after signup)
    try {
      const { privateKey, address } = await createWalletAndAccount();
      user.privateKey = privateKey;
      user.walletAddress = address;
      user.walletStatus = "pending";
      user.walletCreatedAt = new Date();
      await user.save();
    } catch (err) {
      // Do not block signup on wallet failure
      user.walletStatus = "failed";
      await user.save().catch(() => {});
    }

    res.status(201).json({ token: signToken(user._id), user: serializeUser(user) });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken(user._id);
    return res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

module.exports = { register, login, serializeUser };
