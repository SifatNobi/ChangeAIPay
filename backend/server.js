require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const transactionRoutes = require("./routes/transaction");
const { callRpc } = require("./services/rpcClient");
const auth = require("./middleware/auth");
const User = require("./models/User");
const { sendNano, getBalance, confirmTransaction } = require("./services/nanoWallet");

const app = express();

console.log("🚀 Server booting...");

/* ---------------- FETCH COMPAT (Render safety) ---------------- */
const fetch =
  global.fetch ||
  ((...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args)));

/* ---------------- ENV CHECK ---------------- */

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing ENV: ${name}`);
    process.exit(1);
  }
  return value;
}

/* ---------------- CORS ---------------- */

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/* ---------------- ROOT ---------------- */

app.get("/", (_req, res) => {
  res.json({
    status: "Backend running ✅",
    routes: {
      auth: ["/auth/register", "/auth/login"],
      user: "/user/*",
      transaction: "/transaction/*",
      health: "/health",
      test: "/test",
      test_rpc: "/test-rpc",
    },
  });
});

/* ---------------- HEALTH ---------------- */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mongo_state: mongoose.connection.readyState,
    uptime: process.uptime(),
  });
});

/* ---------------- TEST ---------------- */

app.get("/test", (_req, res) => {
  res.send("Server is alive 🚀");
});

/* ---------------- RATE LIMIT ---------------- */

app.use(
  "/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
  })
);

/* ---------------- ROUTES ---------------- */

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/transaction", transactionRoutes);

/* ---------------- RPC TEST ROUTES (FAILOVER) ---------------- */

app.get("/test-rpc", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });
    return res.json({
      success: result.success,
      working_node: result.source || null,
      version: result.data?.node_vendor || null,
      message: result.success ? "RPC connection successful ✅" : "RPC nodes unavailable ❌",
      source: result.source || null,
      error: result.error || null
    });
  } catch (err) {
    return res.json({ success: false, working_node: null, error: String(err?.message || err) });
  }
});

app.get("/rpc-status", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });
    if (!result.success) {
      return res.json({
        status: "offline",
        working_nodes: [],
        error: result.error || "All RPC nodes failed"
      });
    }

    return res.json({
      status: "online",
      working_nodes: [result.source],
      version: result.data?.node_vendor || "unknown",
      network: result.data?.network || "unknown",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.json({ status: "error", error: String(err?.message || err) });
  }
});

/* ---------------- WALLET ROUTES (PATCH: only added if missing) ---------------- */

// Public: read-only balance lookup (no secrets).
app.get("/balance/:account", async (req, res) => {
  try {
    const result = await getBalance(req.params.account);
    return res.json(result);
  } catch (err) {
    return res.json({ success: false, data: null, error: "RPC failure", source: null });
  }
});

// Authenticated: send from the caller's server-stored wallet key. Never accepts private keys from clients.
app.post("/send", auth, async (req, res) => {
  try {
    const recipientInput = String(req.body?.recipient || req.body?.to || "").trim();
    const amountNano = String(req.body?.amount || "").trim();

    if (!recipientInput) {
      return res.json({ success: false, data: null, error: "Recipient is required", source: null });
    }
    if (!amountNano) {
      return res.json({ success: false, data: null, error: "Amount is required", source: null });
    }

    const sender = await User.findById(req.user.id).select("+privateKey");
    if (!sender) {
      return res.json({ success: false, data: null, error: "User not found", source: null });
    }

    if (!sender.walletAddress || !sender.privateKey) {
      return res.json({ success: false, data: null, error: "Sender wallet is not ready", source: null });
    }

    const receiver = recipientInput.includes("@")
      ? await User.findOne({ email: recipientInput.toLowerCase() }).lean()
      : await User.findOne({ walletAddress: recipientInput }).lean();

    if (!receiver) {
      return res.json({ success: false, data: null, error: "Recipient user not found", source: null });
    }

    if (!receiver.walletAddress) {
      return res.json({ success: false, data: null, error: "Recipient wallet is not ready", source: null });
    }

    if (String(receiver._id) === String(sender._id)) {
      return res.json({ success: false, data: null, error: "Cannot send Nano to yourself", source: null });
    }

    const result = await sendNano({
      privateKey: sender.privateKey,
      fromAddress: sender.walletAddress,
      toAddress: receiver.walletAddress,
      amountNano
    });

    return res.json(result);
  } catch (_err) {
    return res.json({ success: false, data: null, error: "Failed to process Nano transaction", source: null });
  }
});

// Public confirmation status by hash.
app.get("/confirm/:hash", async (req, res) => {
  try {
    const result = await confirmTransaction(req.params.hash);
    return res.json(result);
  } catch (_err) {
    return res.json({ success: false, data: null, error: "RPC failure", source: null });
  }
});

/* ---------------- 404 ---------------- */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

/* ---------------- ERROR HANDLERS ---------------- */

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:", err);
});

/* ---------------- START SERVER ---------------- */

async function start() {
  console.log("Starting server...");

  const mongoUri = getEnv("MONGO_URI");
  getEnv("JWT_SECRET");

  if (!process.env.RPC_URL) {
    console.warn("⚠ RPC_URL not set. Nano transactions will fail.");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("❌ MongoDB failed:", err);
    process.exit(1);
  }

  const port = process.env.PORT || 3000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});