import path from "path";
import { fileURLToPath } from "url";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.js";
import userRoutes from "./routes/user.js";
import waitlistRoutes from "./routes/waitlist.js";
import walletRoutes from "./routes/wallet.js";
import { callRpc, getNodeHealth, RPC_NODES, testRpcNodes } from "./services/rpcClient.js";
import walletQueue from "./services/walletQueue.js";
import { confirmTransaction, getBalance } from "./services/nanoWallet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

getRequiredEnv("MONGO_URI");
getRequiredEnv("JWT_SECRET");

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ||
    "https://changeaipay.netlify.app,http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,
  /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "ChangeAIPay backend",
    routes: {
      auth: "/api/auth",
      user: "/api/user",
      transaction: "/api/transaction",
      waitlist: "/api/waitlist",
      wallet: "/api/wallet",
      health: "/health"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mongoState: mongoose.connection.readyState,
    uptime: process.uptime()
  });
});

app.get("/test", (_req, res) => {
  res.send("Server is alive");
});

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/wallet", walletRoutes);

walletQueue.startWorker();

app.get("/test-rpc", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });

    return res.json({
      status: result.success ? "ONLINE" : "OFFLINE",
      success: result.success,
      workingNode: result.source || null,
      message: result.success ? "RPC connection successful" : "All RPC nodes failed",
      version: result.data?.node_vendor || null,
      network: result.data?.network || null,
      error: result.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(502).json({
      status: "ERROR",
      success: false,
      error: String(err?.message || err)
    });
  }
});

app.get("/rpc-debug", async (_req, res) => {
  try {
    const result = await callRpc({ action: "version" });

    return res.json({
      success: result.success,
      workingNode: result.source || null,
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

app.get("/health-full", async (_req, res) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = ["disconnected", "connected", "connecting", "disconnecting"];
    const rpcTest = await callRpc({ action: "version" });
    const nodeHealth = getNodeHealth();
    const healthyNodes = nodeHealth.filter((node) => node.healthy).length;

    return res.json({
      status: mongoState === 1 && rpcTest.success ? "PRODUCTION READY" : "DEGRADED",
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: mongoState === 1,
        state: mongoStates[mongoState],
        ready: mongoState === 1
      },
      rpc: {
        status: rpcTest.success ? "HEALTHY" : "UNHEALTHY",
        workingNode: rpcTest.source || "none",
        healthyNodes: `${healthyNodes}/${RPC_NODES.length}`,
        nodes: nodeHealth,
        network: rpcTest.data?.network || "unknown"
      },
      message: "ChangeAIPay backend status"
    });
  } catch (err) {
    return res.status(500).json({
      status: "ERROR",
      error: String(err?.message || err)
    });
  }
});

app.get("/rpc-health", async (_req, res) => {
  try {
    const nodeHealth = getNodeHealth();
    const testResults = await testRpcNodes();
    const onlineCount = testResults.filter((result) => result.online).length;

    return res.json({
      status: onlineCount > 0 ? "HEALTHY" : "CRITICAL",
      onlineNodes: `${onlineCount}/${RPC_NODES.length}`,
      nodes: testResults,
      nodeHealth,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: "ERROR",
      error: String(err?.message || err)
    });
  }
});

app.get("/demo-payment-flow", async (_req, res) => {
  try {
    return res.json({
      status: "READY FOR DEMO",
      supportedOperations: [
        "POST /api/transaction/send - Send Nano to recipient",
        "GET /api/transaction/history - View payment history",
        "GET /balance/:account - Check account balance"
      ],
      paymentFlow: {
        step1: "User initiates payment with recipient and amount",
        step2: "Backend validates sender balance",
        step3: "Backend builds and signs Nano block",
        step4: "Broadcast via RPC with automatic failover",
        step5: "Poll for confirmation (max 10-20 seconds)",
        step6: "Return tx_hash and status to frontend"
      },
      demoReady: true
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get("/balance/:account", async (req, res) => {
  try {
    const result = await getBalance(req.params.account);
    return res.json(result);
  } catch {
    return res.json({ success: false, data: null, error: "RPC failure", source: null });
  }
});

app.get("/confirm/:hash", async (req, res) => {
  try {
    const result = await confirmTransaction(req.params.hash);
    return res.json(result);
  } catch {
    return res.json({ success: false, data: null, error: "RPC failure", source: null });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

async function start() {
  if (!process.env.RPC_NODES) {
    console.warn("RPC_NODES not configured. Falling back to default public nodes.");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
