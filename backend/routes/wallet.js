import express from "express";
import walletQueue from "../services/walletQueue.js";

const router = express.Router();

router.post("/retry/:userId", async (req, res) => {
  try {
    await walletQueue.retryWalletForUser(req.params.userId);
    res.json({ ok: true, message: "Wallet provisioning re-queued" });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});
export default router;
