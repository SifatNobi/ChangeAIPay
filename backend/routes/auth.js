import express from "express";
import auth from "../middleware/auth.js";
import { list } from "../controllers/transactionsController.js";

const router = express.Router();

router.get("/transactions", auth, list);

export default router;
