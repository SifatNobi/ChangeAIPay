require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const transactionRoutes = require("./routes/transaction");
const { callRpc } = require("./services/rpcClient");

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
  const result = await callRpc({ action: "version" });
  return res.json(result);
});

app.get("/rpc-status", async (_req, res) => {
  const result = await callRpc({ action: "version" });
  return res.json(result);
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