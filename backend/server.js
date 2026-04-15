require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const txRoutes = require("./routes/transactions");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/", walletRoutes);
app.use("/", txRoutes);

// Serve frontend (optional, keeps demo simple)
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));

async function start() {
  const { MONGO_URI, PORT } = process.env;
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment");
  }

  await mongoose.connect(MONGO_URI, { autoIndex: true });

  const port = Number(PORT || 3000);
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

