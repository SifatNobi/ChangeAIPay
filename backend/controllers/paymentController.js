import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { sendNano as sendNanoTransaction } from "../services/nanoWallet.js";
import { analyzeTransaction, getSmartConfirmation } from "../services/fraudDetection.js";
import logger from "../services/logger.js";
import wsManager from "../services/websocket.js";
import notificationService from "../services/notificationService.js";

export async function sendPayment(req, res) {
  try {
    const userId = req.user._id;
    const { recipient, amount, note, skipFraudCheck } = req.body;

    if (!recipient || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: "Recipient and amount are required" 
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid amount" 
      });
    }

    const user = await User.findById(userId).lean();
    
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        error: "No wallet found. Please set up your wallet first."
      });
    }

    let fraudAnalysis = null;
    
    if (!skipFraudCheck) {
      fraudAnalysis = await analyzeTransaction(userId, {
        recipient,
        amount: numericAmount,
        direction: "outgoing"
      });

      const confirmation = await getSmartConfirmation(fraudAnalysis, userId, {
        recipient,
        amount: numericAmount
      });

      if (confirmation.action === "block") {
        return res.status(403).json({
          success: false,
          error: confirmation.message,
          explanation: confirmation.explanation,
          requiresReview: true
        });
      }

      if (confirmation.requiresConfirmation) {
        return res.status(200).json({
          success: true,
          requiresConfirmation: true,
          verificationSteps: confirmation.verificationSteps,
          explanation: confirmation.explanation,
          riskScore: fraudAnalysis.riskScore
        });
      }
    }

    const txHash = await sendNanoTransaction(user.walletAddress, recipient, numericAmount);

    const transaction = await Transaction.create({
      userId,
      type: "send",
      amount: numericAmount.toString(),
      amountRaw: (numericAmount * 1e30).toString(),
      direction: "outgoing",
      fromAddress: user.walletAddress,
      toAddress: recipient,
      hash: txHash,
      status: "pending",
      metadata: {
        note,
        fraudScore: fraudAnalysis?.riskScore || 0,
        fraudCheckPassed: !fraudAnalysis?.requiresReview
      }
    });

    wsManager.notifyTransaction(userId, {
      id: transaction._id,
      type: "send",
      amount: numericAmount,
      to: recipient,
      hash: txHash,
      status: "pending",
      direction: "outgoing"
    });

    logger.info("Payment sent", { userId, amount: numericAmount, txHash });

    res.json({
      success: true,
      tx_hash: txHash,
      transaction_id: transaction._id,
      status: "pending",
      message: "Payment submitted successfully"
    });
  } catch (err) {
    logger.error("Payment error", { userId: req.user._id, error: err.message });
    res.status(500).json({
      success: false,
      error: err.message || "Payment failed"
    });
  }
}

export async function requestPayment(req, res) {
  try {
    const userId = req.user._id;
    const { amount, description, expiresIn } = req.body;

    const user = await User.findById(userId).lean();

    const paymentRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: user.walletAddress,
      amount: parseFloat(amount) || 0,
      description: description || "",
      createdAt: new Date().toISOString(),
      expiresAt: expiresIn 
        ? new Date(Date.now() + expiresIn * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "pending"
    };

    wsManager.notifyNotification(userId, {
      type: "payment_request",
      title: "Payment Request Created",
      body: `Request for ${paymentRequest.amount} XNO ready to share`,
      data: paymentRequest
    });

    res.json({
      success: true,
      paymentRequest,
      shareUrl: `${process.env.FRONTEND_URL}/receive?request=${paymentRequest.id}`,
      qrData: `nano:${user.walletAddress}?amount=${paymentRequest.amount}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create payment request" });
  }
}

export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user._id;
    const { limit = 50, offset = 0, type } = req.query;

    const query = { userId };
    if (type) query.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query)
    ]);

    const summary = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$direction",
          total: { $sum: { $toDouble: "$amount" } },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      transactions,
      total,
      summary: {
        received: summary.find(s => s._id === "incoming")?.total || 0,
        sent: summary.find(s => s._id === "outgoing")?.total || 0,
        count: total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
}

export async function getTransactionDetails(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const transaction = await Transaction.findOne({ _id: id, userId }).lean();

    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    res.json({ success: true, transaction });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch transaction" });
  }
}

export async function verifyRecipient(req, res) {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, error: "Address required" });
    }

    const recipientUser = await User.findOne({ walletAddress: address }).lean();

    res.json({
      success: true,
      verified: !!recipientUser,
      recipient: recipientUser ? {
        name: recipientUser.name,
        verified: recipientUser.verification?.emailVerified || false
      } : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Verification failed" });
  }
}

export async function calculateFX(req, res) {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    const rates = {
      XNO: 1,
      USD: 0.007,
      EUR: 0.0065,
      GBP: 0.0056
    };

    const fromRate = rates[fromCurrency?.toUpperCase()] || 1;
    const toRate = rates[toCurrency?.toUpperCase()] || rates.USD;

    const baseAmount = parseFloat(amount) / fromRate;
    const convertedAmount = baseAmount * toRate;

    const fee = baseAmount * 0.0145;

    res.json({
      success: true,
      conversion: {
        from: { amount: parseFloat(amount), currency: fromCurrency?.toUpperCase() || "XNO" },
        to: { amount: convertedAmount.toFixed(6), currency: toCurrency?.toUpperCase() || "USD" },
        rate: (toRate / fromRate).toFixed(6),
        fee: fee.toFixed(6)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Conversion failed" });
  }
}

export async function getSmartRouting(req, res) {
  try {
    const { amount, destination } = req.body;

    const routes = [
      { name: "Nano Network", fee: 0, time: "instant", reliability: 99 },
      { name: "Standard Route", fee: 0.001, time: "< 5 min", reliability: 95 }
    ];

    const bestRoute = routes[0];

    res.json({
      success: true,
      routing: {
        recommended: bestRoute,
        alternatives: routes.slice(1),
        savings: 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Routing failed" });
  }
}

export async function undoPayment(req, res) {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId,
      status: "pending" 
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or cannot be undone"
      });
    }

    const timeSinceCreation = Date.now() - new Date(transaction.createdAt).getTime();
    const maxUndoTime = 30 * 1000;

    if (timeSinceCreation > maxUndoTime) {
      return res.status(400).json({
        success: false,
        error: "Transaction too old to undo. Already processed."
      });
    }

    transaction.status = "cancelled";
    transaction.metadata = transaction.metadata || {};
    transaction.metadata.undone = true;
    transaction.metadata.undoneAt = new Date();
    await transaction.save();

    wsManager.notifyTransaction(userId, {
      id: transaction._id,
      status: "cancelled",
      message: "Transaction cancelled/undone"
    });

    res.json({
      success: true,
      message: "Transaction successfully cancelled"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to undo transaction" });
  }
}

export async function getPaymentTranscript(req, res) {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId 
    }).lean();

    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    const transcript = {
      transaction: {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency || "XNO",
        direction: transaction.direction,
        status: transaction.status,
        timestamp: transaction.createdAt
      },
      parties: {
        sender: transaction.fromAddress,
        receiver: transaction.toAddress
      },
      blockchain: {
        hash: transaction.hash,
        block: transaction.block,
        confirmations: transaction.confirmations || 0
      },
      metadata: {
        fee: transaction.fee || "0",
        note: transaction.metadata?.description || null
      }
    };

    res.json({ success: true, transcript });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to generate transcript" });
  }
}

export default {
  sendPayment,
  requestPayment,
  getPaymentHistory,
  getTransactionDetails,
  verifyRecipient,
  calculateFX,
  getSmartRouting,
  undoPayment,
  getPaymentTranscript
};