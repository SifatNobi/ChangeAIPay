const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signToken(userId) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }

  return jwt.sign(
    { uid: String(userId) },
    secret,
    {
      subject: String(userId),
      expiresIn: "7d"
    }
  );
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    walletAddress: user.walletAddress || null,
    walletStatus: user.walletStatus || "pending",
    walletId: user.walletId || null,
    walletCreatedAt: user.walletCreatedAt || null,
    createdAt: user.createdAt
  };
}

async function register(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) {
      return res.status(400).json({
        error: "Name must be at least 2 characters"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Valid email required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters"
      });
    }

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({
        error: "Email already in use"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      walletStatus: "pending"
    });

    // Optional wallet queue (non-blocking)
    try {
      const walletQueue = require("../services/walletQueue");

      if (
        walletQueue &&
        typeof walletQueue.enqueueWalletJob === "function"
      ) {
        walletQueue.enqueueWalletJob(user._id);
      }
    } catch (err) {
      console.log("[walletQueue skipped]", err.message);
    }

    const token = signToken(user._id);

    return res.status(201).json({
      token,
      user: serializeUser(user)
    });

  } catch (err) {
    console.error("[REGISTER ERROR]", err);

    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err)
    });
  }
}

async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Valid email required"
      });
    }

    // ✅ CRITICAL FIX
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    if (!user.password) {
      console.error("[LOGIN ERROR] Missing password hash for:", email);

      return res.status(500).json({
        error: "Password data missing in database"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      token,
      user: serializeUser(user)
    });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);

    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err)
    });
  }
}

module.exports = {
  register,
  login,
  serializeUser
};