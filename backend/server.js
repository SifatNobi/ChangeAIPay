require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const transactionRoutes = require("./routes/transaction");

const app = express();

/* ---------------- ENV HELPERS ---------------- */

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing ${name} in environment`);
  }
  return value;
}

function getAllowedOrigins() {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
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
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

/* ---------------- HEALTH CHECK ---------------- */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mongoReadyState: mongoose.connection.readyState,
    nanoRpcConfigured: Boolean(process.env.RPC_URL)
  });
});

/* ---------------- RATE LIMIT ---------------- */

app.use(
  "/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* ---------------- ROUTES ---------------- */

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/transaction", transactionRoutes);

/* ---------------- 404 ---------------- */

app.use((req, res) => {
  return res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

/* ---------------- MONGODB EVENTS ---------------- */

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongo runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

/* ---------------- START SERVER (FIXED FOR RENDER) ---------------- */

async function start() {
  const mongoUri = getRequiredEnv("MONGO_URI");
  getRequiredEnv("JWT_SECRET");

  if (!process.env.RPC_URL) {
    console.warn(
      "RPC_URL is not configured. Wallet features may fail."
    );
  }

  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoUri, {
      autoIndex: true
    });

    console.log("MongoDB connection established");
  } catch (err) {
    console.error("Mongo connection error:", err);
    process.exit(1);
  }

  const port = process.env.PORT || 3000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`Backend running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});