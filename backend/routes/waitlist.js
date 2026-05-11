import express from "express";
import { joinWaitlist, getWaitlistStats, exportWaitlist, updateWaitlistEntry } from "../controllers/waitlistController.js";
import safeRoute from "../middleware/safeRoute.js";
import { authMiddleware, roleMiddleware } from "../middleware/security.js";

const router = express.Router();

router.post("/", safeRoute(joinWaitlist));

router.get("/stats", authMiddleware, roleMiddleware("admin"), safeRoute(getWaitlistStats));

router.get("/export", authMiddleware, roleMiddleware("admin"), safeRoute(exportWaitlist));

router.patch("/:id", authMiddleware, roleMiddleware("admin"), safeRoute(updateWaitlistEntry));

export default router;
