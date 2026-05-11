import express from "express";
import { verifyWebhookSignature, handleWebhookEvent } from "../services/webhookService.js";
import logger from "../services/logger.js";

const router = express.Router();

router.post("/", express.json(), async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const eventType = req.headers["x-webhook-event"] || req.body.type;

    const payload = JSON.stringify(req.body);
    const payloadString = req.body;

    if (!verifyWebhookSignature(payload, signature, timestamp)) {
      logger.warn("Webhook signature verification failed", {
        signature: signature ? "present" : "missing",
        timestamp: timestamp ? "present" : "missing"
      });
      return res.status(401).json({ error: "Invalid signature" });
    }

    const result = await handleWebhookEvent(eventType, payloadString, req.headers);

    if (result.success === false && result.reason === "duplicate_event") {
      return res.status(200).json({ received: true, status: "duplicate" });
    }

    res.json({ 
      received: true, 
      processed: result.success,
      type: result.type || eventType
    });
  } catch (err) {
    logger.error("Webhook processing error", { error: err.message });
    res.status(500).json({ error: "Processing failed" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { getWebhookStats } = await import("../services/webhookService.js");
    const stats = await getWebhookStats(7);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get stats" });
  }
});

router.post("/test", express.json(), async (req, res) => {
  try {
    const { eventType, payload } = req.body;
    const result = await handleWebhookEvent(eventType, payload, {});
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;