require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const transactionRoutes = require("./routes/transaction");

const app = express();

/* ---------------- DEBUG START ---------------- */

console.log("Server file loaded...");

/* ---------------- ENV HELPERS ---------------- */

function getEnv(name, required = true) {
  const value = process.env[name];

  if (required && !value) {
    console.error(`❌ Missing environment variable: ${name}`);
    process.exit(1);
  }

  return value;
}

function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

/* ---------------- CORS ---------------- */

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked origin: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/* ---------------- HEALTH CHECK ---------------- */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mongoReadyState: mongoose.connection.readyState,
    uptime: process.uptime(),
  });
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

/* ---------------- 404 ---------------- */

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* ---------------- GLOBAL ERROR HANDLERS (IMPORTANT) ---------------- */

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
  const jwtSecret = getEnv("JWT_SECRET");

  if (!process.env.RPC_URL) {
    console.warn("⚠ RPC_URL not set. Wallet features may fail.");
  }

  console.log("Connecting to MongoDB...");

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("❌ Mongo connection failed:", err);
    process.exit(1);
  }

  const port = process.env.PORT || 3000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Backend running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});