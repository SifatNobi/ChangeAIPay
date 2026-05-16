import express from "express";
import { authMiddleware } from "../middleware/security.js";
import * as billingController from "../controllers/billingController.js";

const router = express.Router();

router.get("/plans", billingController.getPricingPlans);

router.post("/checkout", authMiddleware, async (req, res) => {
  await billingController.createCheckoutSession(req, res);
});

router.post("/process", authMiddleware, async (req, res) => {
  await billingController.processPayment(req, res);
});

router.get("/methods", authMiddleware, async (req, res) => {
  await billingController.getPaymentMethods(req, res);
});

router.get("/history", authMiddleware, async (req, res) => {
  await billingController.getBillingHistory(req, res);
});

router.post("/cancel", authMiddleware, async (req, res) => {
  await billingController.cancelSubscription(req, res);
});

router.get("/analytics", authMiddleware, async (req, res) => {
  await billingController.getPaymentAnalytics(req, res);
});

router.post("/pause", authMiddleware, async (req, res) => {
  await billingController.pauseSubscription(req, res);
});

router.post("/resume", authMiddleware, async (req, res) => {
  await billingController.resumeSubscription(req, res);
});

router.post("/change-plan", authMiddleware, async (req, res) => {
  await billingController.changePlanWithProration(req, res);
});

router.get("/subscription-analytics", authMiddleware, async (req, res) => {
  await billingController.getSubscriptionAnalytics(req, res);
});

router.get("/ai-recommendations", authMiddleware, async (req, res) => {
  await billingController.getAIRecommendations(req, res);
});

router.get("/plan-comparison", authMiddleware, async (req, res) => {
  await billingController.getPlanComparison(req, res);
});

router.get("/renewal-reminder", authMiddleware, async (req, res) => {
  await billingController.getRenewalReminder(req, res);
});

router.post("/verify-payment", authMiddleware, async (req, res) => {
  await billingController.verifyPaymentAndActivate(req, res);
});

router.post("/cancel-payment", authMiddleware, async (req, res) => {
  await billingController.cancelPaymentSession(req, res);
});

router.post("/activate-free-trial", authMiddleware, async (req, res) => {
  await billingController.activateFreeTrial(req, res);
});

router.post("/complete-first-transaction", authMiddleware, async (req, res) => {
  await billingController.completeFirstTransaction(req, res);
});

export default router;