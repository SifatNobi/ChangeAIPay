import express from "express";
import auth from "../middleware/auth.js";
import transactionController from "../controllers/transactionController.js";

const router = express.Router();

router.post("/send", auth, transactionController.send);
router.get("/history", auth, transactionController.history);
router.get("/:id/status", auth, transactionController.status);

export default router;
