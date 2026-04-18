require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const transactionRoutes = require("./routes/transaction");
const waitlistRoutes = require("./routes/waitlist");
const { callRpc, RPC_NODES, getNodeHealth, testRpcNodes } = require("./services/rpcClient");
const auth = require("./middleware/auth");
const User = require("./models/User");
const { sendNano, getBalance, confirmTransaction, autoReceive } = require("./services/nanoWallet");

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
app.use("/waitlist", waitlistRoutes);

/* ========== DEMO-READY RPC & HEALTH ROUTES (PHASE 7) ========== */

// SIMPLE RPC TEST (for demo)
app.get("/test-rpc", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });
    const status = result.success ? "✅ ONLINE" : "❌ OFFLINE";
    return res.json({
      status,
      success: result.success,
      working_node: result.source || null,
      message: result.success ? "RPC connection successful" : "All RPC nodes failed",
      version: result.data?.node_vendor || null,
      network: result.data?.network || null,
      error: result.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(502).json({ 
      status: "❌ ERROR",
      success: false, 
      error: String(err?.message || err) 
    });
  }
});

// DEBUGGING RPC FAILOVER
app.get("/rpc-debug", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });
    return res.json({
      success: result.success,
      working_node: result.source || null,
      data: result.data || null,
      error: result.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: String(err?.message || err)
    });
  }
});

// COMPREHENSIVE HEALTH CHECK (for demo)
app.get("/health-full", async (_req, res) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = ["disconnected", "connected", "connecting", "disconnecting"];
    
    const rpcTest = await callRpc({ action: "version" });
    const nodeHealth = getNodeHealth();
    
    // Count healthy nodes
    const healthyNodes = nodeHealth.filter(n => n.healthy).length;
    
    return res.json({
      status: mongoState === 1 && rpcTest.success ? "🟢 PRODUCTION READY" : "🟡 DEGRADED",
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        connected: mongoState === 1,
        state: mongoStates[mongoState],
        ready: mongoState === 1 ? "✅ Yes" : "❌ No"
      },
      rpc: {
        status: rpcTest.success ? "✅ HEALTHY" : "❌ UNHEALTHY",
        working_node: rpcTest.source || "none",
        healthy_nodes: `${healthyNodes}/${RPC_NODES.length}`,
        nodes: nodeHealth,
        network: rpcTest.data?.network || "unknown"
      },
      message: "ChangeAIPay Backend Status"
    });
  } catch (err) {
    return res.status(500).json({ 
      status: "🔴 ERROR",
      error: String(err?.message || err) 
    });
  }
});

// NODE HEALTH DETAILED (for investigating issues)
app.get("/rpc-health", async (_req, res) => {
  try {
    const nodeHealth = getNodeHealth();
    const testResults = await testRpcNodes();
    const onlineCount = testResults.filter((r) => r.online).length;

    return res.json({
      status: onlineCount > 0 ? "✅ HEALTHY" : "❌ CRITICAL",
      online_nodes: `${onlineCount}/${RPC_NODES.length}`,
      nodes: testResults,
      node_health: nodeHealth,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: "🔴 ERROR",
      error: String(err?.message || err)
    });
  }
});

// PAYMENT FLOW TESTER (for demo)
app.get("/demo-payment-flow", async (_req, res) => {
  try {
    return res.json({
      status: "🚀 READY FOR DEMO",
      supported_operations: [
        "POST /transaction/send - Send Nano to recipient",
        "GET /transaction/history - View payment history",
        "GET /balance/:account - Check account balance"
      ],
      payment_flow: {
        step1: "User initiates payment with recipient and amount",
        step2: "Backend validates sender balance",
        step3: "Backend builds and signs Nano block",
        step4: "Broadcast via RPC with automatic failover",
        step5: "Poll for confirmation (max 10-20 seconds)",
        step6: "Return tx_hash and status to frontend"
      },
      error_handling: {
        insufficient_balance: "Checked before sending (no double charges)",
        account_not_opened: "Sender must receive funds first",
        rpc_failed: "Retries all nodes, returns clear error",
        invalid_input: "Validation on sender input"
      },
      demo_ready: true,
      message: "Payment system is production-ready"
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
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

  if (!process.env.RPC_NODES) {
    console.warn("⚠ RPC_NODES not configured. Falling back to default public nodes.");
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