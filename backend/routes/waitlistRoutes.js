import express from 'express';
import Waitlist from '../models/Waitlist.js';

const router = express.Router();

router.post('/join', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    await Waitlist.create({ email });
    res.status(201).json({ message: 'Successfully joined waitlist' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
