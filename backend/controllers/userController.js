import User from "../models/User.js";
import authController from "../controllers/authController.js";
import { getAccountBalance } from "../services/nano.js";

async function profile(req, res) {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let balance = null;
    if (user.walletAddress) {
      try {
        balance = await getAccountBalance(user.walletAddress);
      } catch (error) {
        balance = {
          balanceRaw: "0",
          pendingRaw: "0",
          balanceNano: "0",
          pendingNano: "0",
          error: String(error?.message || error)
        };
      }
    }

    return res.json({
      user: authController.serializeUser(user),
      balance
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

export default { profile };
