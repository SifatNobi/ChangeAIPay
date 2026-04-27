import express from "express";
import auth from "../middleware/auth.js";
import userController from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", auth, userController.profile);

export default router;
