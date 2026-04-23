import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Register new user
router.post('/register', authController.register);

// Login existing user
router.post('/login', authController.login);

export default router;
