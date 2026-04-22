const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { createWalletAndAccount, getAccountBalance, nanoToRaw, sendFromWallet } = require("../services/nano");

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

async function createWallet(req, res) {
  try {
    const user = await User.findById(req.user.id).select("+walletId");
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.walletAddress && user.walletId) {
      return res.json({ walletAddress: user.walletAddress });
    }

    const { walletId, address } = await createWalletAndAccount();
    user.walletId = walletId;
    user.walletAddress = address;
    await user.save();

    return res.status(201).json({ walletAddress: address });
  } catch (err) {
    return res.status(502).json({ error: "Failed to create wallet via Nano RPC", details: String(err?.message || err) });
  }
}

async function balance(req, res) {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found", state: "failed" });
    if (!user.walletAddress) return res.status(400).json({ success: false, error: "Wallet not created", state: "failed" });

    const b = await getAccountBalance(user.walletAddress);
    
    // Add wallet state to response
    if (!b) {
      return res.json({
        success: true,
        balance: "0",
        balanceNano: "0",
        state: "not_activated",
        message: "Wallet not activated - no balance yet"
      });
    }

    // Determine state based on balance
    let state;
    if (!b.exists) {
      state = "not_activated";
    } else if (b.balance === "0" || BigInt(b.balance || "0") === BigInt(0)) {
      state = "needs_funding";
    } else {
      state = "ready";
    }

    return res.json({
      ...b,
      state,
      message: state === "ready" ? "Wallet ready" : `Wallet state: ${state}`
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: "Failed to fetch balance via Nano RPC", state: "failed", details: String(err?.message || err) });
  }
}

async function sendPayment(req, res) {
  try {
    const to = String(req.body?.to || "").trim();
    const amountNano = String(req.body?.amount || "").trim();

    if (!to) return res.status(400).json({ success: false, error: "Recipient is required", state: "failed" });
    if (!amountNano) return res.status(400).json({ success: false, error: "Amount is required", state: "failed" });

    const sender = await User.findById(req.user.id).select("+walletId");
    if (!sender) return res.status(404).json({ success: false, error: "User not found", state: "failed" });
    if (!sender.walletAddress || !sender.walletId) return res.status(400).json({ success: false, error: "Wallet not created", state: "failed" });

    const receiver =
      to.includes("@")
        ? await User.findOne({ email: to.toLowerCase().trim() }).lean()
        : await User.findOne({ walletAddress: to }).lean();

    if (!receiver) return res.status(404).json({ success: false, error: "Recipient user not found", state: "failed" });
    if (!receiver.walletAddress) return res.status(400).json({ success: false, error: "Recipient has no wallet", state: "failed" });
    if (String(receiver._id) === String(sender._id)) return res.status(400).json({ success: false, error: "Cannot send to yourself", state: "failed" });

    let amountRaw;
    try {
      amountRaw = nanoToRaw(amountNano);
    } catch (e) {
      return res.status(400).json({ success: false, error: String(e?.message || e), state: "failed" });
    }

    const { txHash } = await sendFromWallet({
      walletId: sender.walletId,
      fromAddress: sender.walletAddress,
      toAddress: receiver.walletAddress,
      amountRaw
    });

    await Transaction.create({
      sender: sender._id,
      receiver: receiver._id,
      amountRaw,
      amountNano,
      txHash,
      timestamp: new Date()
    });

    return res.status(201).json({ success: true, state: "processing", txHash });
  } catch (err) {
    const isStructured = err && typeof err === "object" && err.state;
    const state = isStructured ? err.state : "failed";
    return res.status(502).json({ success: false, error: "Failed to send via Nano RPC", state, details: String(err?.message || err) });
  }
}

async function dashboard(req, res) {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const [b, recent] = await Promise.all([
      user.walletAddress ? getAccountBalance(user.walletAddress).catch(() => null) : Promise.resolve(null),
      Transaction.find({ $or: [{ sender: user._id }, { receiver: user._id }] })
        .sort({ timestamp: -1 })
        .limit(25)
        .populate("sender", "email walletAddress")
        .populate("receiver", "email walletAddress")
        .lean()
    ]);

    // Determine wallet state
    let walletState = "not_activated";
    if (b) {
      if (b.exists && BigInt(b.balance || "0") > BigInt(0)) {
        walletState = "ready";
      } else if (b.exists) {
        walletState = "needs_funding";
      }
    }

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, walletAddress: user.walletAddress, createdAt: user.createdAt },
      wallet: {
        ...b,
        state: walletState
      },
      recentTransactions: recent.map((t) => ({
        txHash: t.txHash,
        amountNano: t.amountNano,
        timestamp: t.timestamp,
        sender: { email: t.sender?.email, walletAddress: t.sender?.walletAddress },
        receiver: { email: t.receiver?.email, walletAddress: t.receiver?.walletAddress }
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error", details: String(err?.message || err) });
  }
}

export { me, createWallet, balance, sendPayment, dashboard };

