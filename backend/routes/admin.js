import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/security.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/dashboard", async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalTransactions,
      users,
      transactions
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      Transaction.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(10).lean(),
      Transaction.find().sort({ createdAt: -1 }).limit(20).populate("userId", "name email").lean()
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayTransactions = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      totalTransactions,
      volume24h: todayTransactions[0]?.total?.toFixed(2) || "0"
    };

    res.json({ stats, users, transactions });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 50, role, status } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const query = status ? { status } : {};

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .lean();

    const total = await Transaction.countDocuments(query);

    res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          volume: { $sum: { $toDouble: "$amount" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const roleStats = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    res.json({ dailyStats, roleStats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;