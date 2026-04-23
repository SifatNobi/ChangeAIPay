import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';

dotenv.config();

const app = express();
// ✅ CHANGED: Default port is now 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/waitlist', waitlistRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('ChangeAI Pay API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
