import express from "express";
import { joinWaitlist } from "../controllers/waitlistController.js";
import safeRoute from "../middleware/safeRoute.js";

const router = express.Router();

router.post("/", safeRoute(joinWaitlist));

export default router;
