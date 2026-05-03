import express from "express";
import auth from "../middleware/auth.js";
import transactionController from "../controllers/transactionController.js";
import safeRoute from "../middleware/safeRoute.js";

const router = express.Router();

router.post("/send", auth, safeRoute(transactionController.send));
router.get("/history", auth, safeRoute(transactionController.history));
router.get("/:id/status", auth, safeRoute(transactionController.status));

export default router;
