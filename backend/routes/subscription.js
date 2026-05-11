import express from "express";
import { authMiddleware } from "../middleware/security.js";
import * as subscriptionController from "../controllers/subscriptionController.js";

const router = express.Router();

router.get("/plans", subscriptionController.getPlans);

router.get("/current", authMiddleware, subscriptionController.getCurrentSubscription);

router.post("/change", authMiddleware, subscriptionController.changePlan);

router.get("/usage", authMiddleware, subscriptionController.getUsage);

router.post("/usage", authMiddleware, subscriptionController.recordUsage);

router.post("/cancel", authMiddleware, subscriptionController.cancelSubscription);

export default router;