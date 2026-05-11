import express from "express";
import { authMiddleware } from "../middleware/security.js";
import * as paymentController from "../controllers/paymentController.js";

const router = express.Router();

router.post("/send", authMiddleware, async (req, res) => {
  await paymentController.sendPayment(req, res);
});

router.post("/request", authMiddleware, async (req, res) => {
  await paymentController.requestPayment(req, res);
});

router.get("/history", authMiddleware, async (req, res) => {
  await paymentController.getPaymentHistory(req, res);
});

router.get("/:id", authMiddleware, async (req, res) => {
  await paymentController.getTransactionDetails(req, res);
});

router.post("/verify-recipient", authMiddleware, async (req, res) => {
  await paymentController.verifyRecipient(req, res);
});

router.post("/convert", authMiddleware, async (req, res) => {
  await paymentController.calculateFX(req, res);
});

router.post("/route", authMiddleware, async (req, res) => {
  await paymentController.getSmartRouting(req, res);
});

router.post("/:id/undo", authMiddleware, async (req, res) => {
  await paymentController.undoPayment(req, res);
});

router.get("/:id/transcript", authMiddleware, async (req, res) => {
  await paymentController.getPaymentTranscript(req, res);
});

export default router;