const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { nanoToRaw, sendFromWallet, waitForConfirmation, ERROR_TYPES, rawToNano } = require("../services/nano");

function normalizeHistoryStatus(status) {
  if (status === "failed") return "failed";
  if (status === "confirmed") return "success";
  return "pending";
}

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
    status: normalizeHistoryStatus(item.status),
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
    return res.status(400).json({ 
      success: false,
      status: "invalid_input",
      error: "Recipient is required" 
    });
  }

  if (!amountNano) {
    return res.status(400).json({ 
      success: false,
      status: "invalid_input", 
      error: "Amount is required" 
    });
  }

  try {
    const sender = await User.findById(req.user.id).select("+privateKey");
    if (!sender) {
      return res.status(404).json({ 
        success: false,
        status: "sender_not_found",
        error: "User not found" 
      });
    }

    if (!sender.walletAddress || !sender.privateKey) {
      return res.status(400).json({ 
        success: false,
        status: "wallet_not_ready",
        error: "Sender wallet is not ready" 
      });
    }

    const receiver = recipientInput.includes("@")
      ? await User.findOne({ email: recipientInput.toLowerCase() })
      : await User.findOne({ walletAddress: recipientInput });

    if (!receiver) {
      return res.status(404).json({ 
        success: false,
        status: "recipient_not_found",
        error: "Recipient user not found" 
      });
    }

    if (String(receiver._id) === String(sender._id)) {
      return res.status(400).json({ 
        success: false,
        status: "invalid_recipient",
        error: "Cannot send Nano to yourself" 
      });
    }

    if (!receiver.walletAddress) {
      return res.status(400).json({ 
        success: false,
        status: "receiver_wallet_not_ready",
        error: "Recipient wallet is not ready" 
      });
    }

    let amountRaw;
    try {
      amountRaw = nanoToRaw(amountNano);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        status: "invalid_amount",
        error: String(error?.message || error) 
      });
    }

    // PHASE 8: DUPLICATE SEND PROTECTION
    // Check for pending/submitted transaction with same details in last 60 seconds
    const recentDuplicate = await Transaction.findOne({
      sender: sender._id,
      receiver: receiver._id,
      amountRaw: amountRaw,
      status: { $in: ["pending", "submitted"] },
      timestamp: { $gte: new Date(Date.now() - 60000) } // Last 60 seconds
    });

    if (recentDuplicate) {
      console.log(`[transactionController] ⚠️ Duplicate send blocked. Recent transaction: ${recentDuplicate._id}`);
      return res.status(400).json({
        success: false,
        status: "duplicate_send",
        error: "This payment was just sent. Please wait a moment before retrying.",
        tx_hash: recentDuplicate.txHash,
        transaction: recentDuplicate.txHash ? formatTransaction(recentDuplicate.toObject(), sender._id) : null
      });
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
      console.log(`[transactionController] 💾 Transaction created: ${transaction._id}`);
      console.log(`[transactionController] 🚀 Starting send: ${amountNano} XNO from ${sender.walletAddress} to ${receiver.walletAddress}`);
      
      const sendResult = await sendFromWallet({
        privateKey: sender.privateKey,
        fromAddress: sender.walletAddress,
        toAddress: receiver.walletAddress,
        amountRaw
      });

      // CRITICAL: sendFromWallet only returns on SUCCESS
      // If it throws, we handle it in catch block below
      const txHash = sendResult.txHash;
      const warning = sendResult.warning;

      console.log(`[transactionController] ✅ Payment successful! Hash: ${txHash}`);

      transaction.txHash = txHash;
      transaction.status = "submitted";
      transaction.submittedAt = new Date();
      
      if (warning) {
        transaction.errorMessage = `⚠️ ${warning}`;
      }
      
      await transaction.save();

      // PHASE 4: CONFIRMATION SYSTEM (non-blocking)
      // Attempt to confirm, but don't fail if not confirmed yet
      try {
        const confirmation = await waitForConfirmation(txHash);
        
        if (confirmation.confirmed) {
          transaction.status = "confirmed";
          transaction.confirmedAt = confirmation.confirmedAt;
          transaction.errorMessage = null;
          console.log(`[transactionController] ✅ Transaction confirmed. Confirmation time: ${confirmation.confirmationTime}ms`);
        } else if (confirmation.pending) {
          // Still pending - don't change status, just log
          console.log(`[transactionController] ⏳ Confirmation pending. Will verify on next check.`);
        }
      } catch (confirmErr) {
        // Confirmation polling is not critical - log but don't fail
        console.warn(`[transactionController] ⚠️ Confirmation check failed: ${String(confirmErr?.message || confirmErr)}`);
      }

      await transaction.save();
      
      return res.status(201).json({
        success: true,
        state: "processing",
        status: "success",
        tx_hash: txHash,
        message: "Payment submitted successfully",
        transaction: formatTransaction(transaction.toObject(), sender._id)
      });

    } catch (error) {
      // PHASE 2: ERROR CLASSIFICATION WITH WALLET STATE
      // sendFromWallet throws structured error objects with status fields
      
      const isStructuredError = error && typeof error === "object" && error.status;
      
      let statusType = ERROR_TYPES.RPC_FAILED;
      let walletState = "failed";
      let httpStatus = 502;
      let errorMsg = "Failed to send Nano transaction";
      let errorDetails = String(error?.message || error);
      let balance = null;
      let balanceNano = null;

      if (isStructuredError) {
        statusType = error.status;
        errorMsg = error.error || "Payment failed";
        balance = error.balance;
        balanceNano = error.balanceNano;
        
        // Use explicit state if provided, otherwise infer from status
        if (error.state) {
          walletState = error.state;
        }

        // Map error types to HTTP status codes and wallet states
        switch (statusType) {
          case ERROR_TYPES.INSUFFICIENT_BALANCE:
            httpStatus = 400;
            walletState = "needs_funding";
            errorMsg = "Insufficient balance";
            console.error(`[transactionController] ❌ Insufficient balance. Have: ${balance}, Need: ${error.amount}`);
            break;
          case ERROR_TYPES.ACCOUNT_NOT_OPENED:
            httpStatus = 400;
            walletState = "not_activated";
            errorMsg = "Account not opened. Please receive Nano first.";
            console.error(`[transactionController] ❌ Account not opened`);
            break;
          case ERROR_TYPES.RPC_FAILED:
            httpStatus = 502;
            walletState = "failed";
            console.error(`[transactionController] ❌ RPC failure: ${errorMsg}`);
            break;
          case ERROR_TYPES.INVALID_INPUT:
            httpStatus = 400;
            walletState = "failed";
            console.error(`[transactionController] ❌ Invalid input: ${errorMsg}`);
            break;
          case ERROR_TYPES.BLOCK_FAILURE:
            httpStatus = 502;
            walletState = "failed";
            console.error(`[transactionController] ❌ Block failure: ${errorMsg}`);
            break;
          default:
            httpStatus = 502;
            walletState = "failed";
            console.error(`[transactionController] ❌ Unknown error: ${errorMsg}`);
        }
      } else {
        // Unstructured Error
        console.error(`[transactionController] ❌ Unstructured error: ${errorDetails}`);
      }

      // CRITICAL: Only mark as failed if transaction was not already submitted
      // This prevents marking as failed if RPC accepted but confirmation failed
      if (transaction.status === "pending") {
        transaction.status = "failed";
        transaction.errorMessage = errorMsg;
        await transaction.save();
      }
      
      return res.status(httpStatus).json({
        success: false,
        state: walletState,
        status: statusType,
        error: errorMsg,
        ...(balance !== null && { balance, balanceNano }),
        tx_hash: transaction.txHash || null,
        transaction: transaction.txHash ? formatTransaction(transaction.toObject(), sender._id) : null
      });
    }
  } catch (err) {
    console.error(`[transactionController] ❌ Server error: ${String(err?.message || err)}`);
    return res.status(500).json({ 
      success: false,
      status: "server_error",
      error: "Server error", 
      details: String(err?.message || err) 
    });
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
      success: true,
      transactions: items.map((item) => formatTransaction(item, req.user.id))
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: String(err?.message || err) 
    });
  }
}

module.exports = { send, history };
