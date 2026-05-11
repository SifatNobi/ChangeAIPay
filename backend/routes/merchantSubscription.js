import express from "express";
import { authMiddleware } from "../middleware/security.js";
import * as merchantSubscriptionController from "../controllers/merchantSubscriptionController.js";

const router = express.Router();

router.get("/plans", merchantSubscriptionController.getMerchantPlans);

router.get("/current", authMiddleware, merchantSubscriptionController.getCurrentMerchantSubscription);

router.post("/revenue-update", authMiddleware, merchantSubscriptionController.updateRevenueTier);

router.get("/analytics", authMiddleware, merchantSubscriptionController.getMerchantAnalytics);

router.post("/analytics", authMiddleware, merchantSubscriptionController.updateMerchantAnalytics);

router.get("/cashflow", authMiddleware, merchantSubscriptionController.getCashFlowPrediction);

router.get("/ltv", authMiddleware, merchantSubscriptionController.getLifetimeValueData);

export default router;