import express from "express";
import authController from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import safeRoute from "../middleware/safeRoute.js";

const router = express.Router();

router.post("/register", safeRoute(authController.register));
router.post("/login", safeRoute(authController.login));
router.get("/me", auth, safeRoute(authController.getMe));

export default router;
