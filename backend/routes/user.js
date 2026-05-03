import express from "express";
import auth from "../middleware/auth.js";
import userController from "../controllers/userController.js";
import safeRoute from "../middleware/safeRoute.js";

const router = express.Router();

router.get("/profile", auth, safeRoute(userController.profile));

export default router;
