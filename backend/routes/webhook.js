import express from "express";
import { verifyWebhookSignature, handleWebhookEvent } from "../services/webhookService.js";
import logger from "../services/logger.js";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-04-30.basil"
});

// Stripe webhook endpoint
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_placeholder";

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        const userId = session.metadata.userId;
        const planId = session.metadata.planId;

        // Update user subscription
        const UserSubscription = (await import("../models/UserSubscription.js")).default;
        await UserSubscription.findOneAndUpdate(
          { userId },
          {
            plan: planId,
            status: "active",
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
          },
          { upsert: true }
        );

        logger.info("Subscription activated via Stripe", { userId, planId, subscriptionId: session.subscription });
        break;

      case "invoice.payment_succeeded":
        // Handle successful renewal
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userSub = await UserSubscription.findOne({ stripeSubscriptionId: invoice.subscription });
          if (userSub) {
            userSub.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            userSub.status = "active";
            await userSub.save();
            logger.info("Subscription renewed", { userId: userSub.userId, planId: userSub.plan });
          }
        }
        break;

      case "invoice.payment_failed":
        // Handle failed payment
        const failedInvoice = event.data.object;
        if (failedInvoice.subscription) {
          const userSub = await UserSubscription.findOne({ stripeSubscriptionId: failedInvoice.subscription });
          if (userSub) {
            userSub.status = "past_due";
            await userSub.save();
            logger.warn("Subscription payment failed", { userId: userSub.userId, planId: userSub.plan });
          }
        }
        break;

      default:
        logger.info("Unhandled Stripe event", { type: event.type });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook processing error", { error: err.message });
    res.status(500).json({ error: "Processing failed" });
  }
});

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