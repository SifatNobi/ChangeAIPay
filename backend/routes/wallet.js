import express from "express";
import walletQueue from "../services/walletQueue.js";
import safeRoute from "../middleware/safeRoute.js";

const router = express.Router();

router.post(
  "/retry/:userId",
  safeRoute(async (req, res) => {
    await walletQueue.retryWalletForUser(req.params.userId);
    res.json({ ok: true, message: "Wallet provisioning re-queued" });
  })
);
export default router;
