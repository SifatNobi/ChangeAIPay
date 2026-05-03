import User from "../models/User.js";
import authController from "../controllers/authController.js";
import { getAccountBalance } from "../services/nano.js";

const cache = new Map();

function setCache(key, data, ttl = 5000) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

async function profile(req, res) {
  try {
    const cacheKey = `profile_${req.user.id}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = await User.findById(req.user.id).maxTimeMS(5000).lean();
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

    const data = {
      user: authController.serializeUser(user),
      balance
    };
    setCache(cacheKey, data);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

export default { profile };
