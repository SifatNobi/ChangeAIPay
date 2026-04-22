const Transaction = require("../models/Transaction");

async function list(req, res) {
  try {
    const limit = Math.min(Number(req.query?.limit || 50), 200);
    const page = Math.max(Number(req.query?.page || 1), 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Transaction.find({ $or: [{ sender: req.user.id }, { receiver: req.user.id }] })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "email walletAddress")
        .populate("receiver", "email walletAddress")
        .lean(),
      Transaction.countDocuments({ $or: [{ sender: req.user.id }, { receiver: req.user.id }] })
    ]);

    return res.json({
      page,
      limit,
      total,
      transactions: items.map((t) => ({
        txHash: t.txHash,
        amountNano: t.amountNano,
        timestamp: t.timestamp,
        sender: { email: t.sender?.email, walletAddress: t.sender?.walletAddress },
        receiver: { email: t.receiver?.email, walletAddress: t.receiver?.walletAddress }
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

export { list };

