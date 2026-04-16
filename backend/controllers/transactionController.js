const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { nanoToRaw, sendFromWallet, waitForConfirmation } = require("../services/nano");

function formatTransaction(item, currentUserId) {
  const senderId = String(item.sender?._id || item.sender);
  const receiverId = String(item.receiver?._id || item.receiver);
  const isOutgoing = senderId === String(currentUserId);
  const counterpart = isOutgoing ? item.receiver : item.sender;

  return {
    id: item._id,
    txHash: item.txHash,
    amountNano: item.amountNano,
    amountRaw: item.amountRaw,
    status: item.status,
    errorMessage: item.errorMessage,
    timestamp: item.timestamp,
    submittedAt: item.submittedAt,
    confirmedAt: item.confirmedAt,
    direction: isOutgoing ? "outgoing" : "incoming",
    senderAddress: item.senderAddress,
    receiverAddress: item.receiverAddress,
    counterpart: {
      id: counterpart?._id || null,
      email: counterpart?.email || null,
      walletAddress: counterpart?.walletAddress || null
    }
  };
}

async function send(req, res) {
  const recipientInput = String(req.body?.recipient || req.body?.to || "").trim();
  const amountNano = String(req.body?.amount || "").trim();

  if (!recipientInput) {
    return res.status(400).json({ error: "Recipient is required" });
  }

  if (!amountNano) {
    return res.status(400).json({ error: "Amount is required" });
  }

  try {
    const sender = await User.findById(req.user.id).select("+privateKey");
    if (!sender) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!sender.walletAddress || !sender.privateKey) {
      return res.status(400).json({ error: "Sender wallet is not ready" });
    }

    const receiver = recipientInput.includes("@")
      ? await User.findOne({ email: recipientInput.toLowerCase() })
      : await User.findOne({ walletAddress: recipientInput });

    if (!receiver) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    if (String(receiver._id) === String(sender._id)) {
      return res.status(400).json({ error: "Cannot send Nano to yourself" });
    }

    if (!receiver.walletAddress) {
      return res.status(400).json({ error: "Recipient wallet is not ready" });
    }

    let amountRaw;
    try {
      amountRaw = nanoToRaw(amountNano);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message || error) });
    }

    const transaction = await Transaction.create({
      sender: sender._id,
      receiver: receiver._id,
      amountRaw,
      amountNano,
      senderAddress: sender.walletAddress,
      receiverAddress: receiver.walletAddress,
      status: "pending",
      timestamp: new Date()
    });

    try {
      const { txHash } = await sendFromWallet({
        privateKey: sender.privateKey,
        fromAddress: sender.walletAddress,
        toAddress: receiver.walletAddress,
        amountRaw
      });

      transaction.txHash = txHash;
      transaction.status = "submitted";
      transaction.submittedAt = new Date();
      await transaction.save();

      const confirmation = await waitForConfirmation(txHash);
      if (confirmation.confirmed) {
        transaction.status = "confirmed";
        transaction.confirmedAt = confirmation.confirmedAt;
        transaction.errorMessage = null;
      }

      if (!confirmation.confirmed && confirmation.error) {
        transaction.errorMessage = String(confirmation.error?.message || confirmation.error);
      }

      await transaction.save();
      return res.status(201).json({
        transaction: formatTransaction(transaction.toObject(), sender._id)
      });
    } catch (error) {
      transaction.status = "failed";
      transaction.errorMessage = String(error?.message || error);
      await transaction.save();
      return res.status(502).json({
        error: "Failed to send Nano transaction",
        details: transaction.errorMessage
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

async function history(req, res) {
  try {
    const limit = Math.min(Number(req.query?.limit || 50), 100);
    const items = await Transaction.find({
      $or: [{ sender: req.user.id }, { receiver: req.user.id }]
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("sender", "email walletAddress")
      .populate("receiver", "email walletAddress")
      .lean();

    return res.json({
      transactions: items.map((item) => formatTransaction(item, req.user.id))
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}

module.exports = { send, history };
