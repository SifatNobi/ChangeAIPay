import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { nanoToRaw, sendFromWallet, waitForConfirmation, ERROR_TYPES, rawToNano } from "../services/nano.js";

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
        status: "failed",
        message: "Recipient not found. Enter a valid email or wallet address.",
        error: "Recipient not found. Enter a valid email or wallet address."
      });
    }

    if (String(receiver._id) === String(sender._id)) {
      return res.status(400).json({ 
        success: false,
        status: "failed",
        message: "You cannot send Nano to yourself.",
        error: "You cannot send Nano to yourself."
      });
    }

    if (!receiver.walletAddress) {
      return res.status(400).json({ 
        success: false,
        status: "failed",
        message: "Recipient wallet is not ready.",
        error: "Recipient wallet is not ready."
      });
    }

    let amountRaw;
    try {
      amountRaw = nanoToRaw(amountNano);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        status: "failed",
        message: "Please enter a valid amount to send.",
        error: "Please enter a valid amount to send." 
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
        status: "failed",
        message: "This payment was just sent. Please wait a moment before retrying.",
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
        status: "success",
        tx_hash: txHash,
        message: "Payment submitted successfully",
        transaction: formatTransaction(transaction.toObject(), sender._id)
      });

    } catch (error) {
      // PHASE 2: ERROR CLASSIFICATION WITH WALLET STATE
      // sendFromWallet throws structured error objects with status fields
      
      const isStructuredError = error && typeof error === "object" && error.status;
      
      let normalizedStatus = "failed";
      let httpStatus = 502;
      let errorMsg = "Unable to process payment. Please try again.";
      let balance = null;
      let balanceNano = null;

      if (isStructuredError) {
        balance = error.balance;
        balanceNano = error.balanceNano;

        switch (error.status) {
          case ERROR_TYPES.INSUFFICIENT_BALANCE:
            normalizedStatus = "action_required";
            httpStatus = 400;
            errorMsg = "Wallet needs funding. Send Nano to your wallet first.";
            console.error(`[transactionController] ❌ Insufficient balance. Have: ${balance}, Need: ${error.amount}`);
            break;
          case ERROR_TYPES.ACCOUNT_NOT_OPENED:
            normalizedStatus = "action_required";
            httpStatus = 400;
            errorMsg = "Wallet not activated. To start sending payments, receive Nano first.";
            console.error(`[transactionController] ❌ Account not opened`);
            break;
          case ERROR_TYPES.RPC_FAILED:
            normalizedStatus = "failed";
            httpStatus = 502;
            errorMsg = "Unable to reach the payment network. Please try again shortly.";
            console.error(`[transactionController] ❌ RPC failure: ${String(error.error || error.message || error)}`);
            break;
          case ERROR_TYPES.INVALID_INPUT:
            normalizedStatus = "failed";
            httpStatus = 400;
            errorMsg = "Please check the recipient and amount and try again.";
            console.error(`[transactionController] ❌ Invalid input: ${String(error.error || error.message || error)}`);
            break;
          case ERROR_TYPES.BLOCK_FAILURE:
            normalizedStatus = "failed";
            httpStatus = 502;
            errorMsg = "Payment could not be completed. Please try again.";
            console.error(`[transactionController] ❌ Block failure: ${String(error.error || error.message || error)}`);
            break;
          default:
            normalizedStatus = "failed";
            httpStatus = 502;
            errorMsg = "Unable to process payment. Please try again.";
            console.error(`[transactionController] ❌ Unknown error: ${String(error.error || error.message || error)}`);
        }
      } else {
        // Unstructured Error
        console.error(`[transactionController] ❌ Unstructured error: ${String(err?.message || err)}`);
      }

      // CRITICAL: Only mark as failed if transaction was not already submitted
      if (transaction.status === "pending") {
        transaction.status = normalizedStatus === "failed" ? "failed" : transaction.status;
        transaction.errorMessage = errorMsg;
        await transaction.save();
      }
      
      return res.status(httpStatus).json({
        success: false,
        status: normalizedStatus,
        message: errorMsg,
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

/* ========== PHASE 11: REAL-TIME STATUS POLLING ==========
   GET /transaction/:id/status
   Polls RPC to check live confirmation status
   Enables frontend to show "Confirming... 23 seconds" UI
   ====================================================== */
async function status(req, res) {
  try {
    const txId = String(req.params?.id || "").trim();
    if (!txId) {
      return res.status(400).json({ success: false, error: "Transaction ID required" });
    }

    const transaction = await Transaction.findById(txId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    // Authorization: user must be sender or receiver
    const userId = String(req.user.id || "");
    const senderId = String(transaction.sender || "");
    const receiverId = String(transaction.receiver || "");
    const isAuthorized = userId === senderId || userId === receiverId;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    let currentStatus = transaction.status;
    let confirmed = false;
    let confirmationTime = null;
    let rpcTimeoutOccurred = false;

    // CRITICAL: If status is "submitted" and we have tx_hash, check RPC for confirmation
    if (currentStatus === "submitted" && transaction.txHash) {
      console.log(`[transactionController/status] 🔍 Checking RPC for tx: ${transaction.txHash}`);
      
      try {
        // PHASE 12: Apply timeout protection (max 5 seconds per RPC check)
        const confirmPromise = waitForConfirmation(transaction.txHash);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("RPC timeout")), 5000)
        );

        const confirmResult = await Promise.race([confirmPromise, timeoutPromise]);
        
        if (confirmResult.confirmed) {
          // Update transaction to confirmed
          transaction.status = "confirmed";
          transaction.confirmedAt = confirmResult.confirmedAt || new Date();
          await transaction.save();
          currentStatus = "confirmed";
          confirmed = true;
          confirmationTime = confirmResult.confirmationTime;
          console.log(`[transactionController/status] ✅ Updated to confirmed: ${transaction._id}`);
        } else if (confirmResult.pending) {
          // Still pending, but no error
          console.log(`[transactionController/status] ⏳ Still pending: ${transaction._id}`);
          confirmed = false;
        }
      } catch (confirmErr) {
        const errMsg = String(confirmErr?.message || confirmErr);
        if (errMsg.includes("RPC timeout")) {
          rpcTimeoutOccurred = true;
          console.warn(`[transactionController/status] ⏱️ RPC timeout - keep polling: ${transaction._id}`);
        } else {
          // Other RPC error, don't fail the response
          console.warn(`[transactionController/status] ⚠️ Confirmation check error: ${errMsg}`);
        }
      }
    }

    // Normalize status for frontend
    const normalizedStatus = normalizeHistoryStatus(currentStatus);

    return res.json({
      success: true,
      transaction_id: transaction._id,
      status: currentStatus,
      normalizedStatus,
      tx_hash: transaction.txHash || null,
      confirmed,
      confirmationTime,
      submittedAt: transaction.submittedAt,
      confirmedAt: transaction.confirmedAt,
      errorMessage: transaction.errorMessage,
      rpcTimeoutOccurred,
      message: confirmed 
        ? "Transaction confirmed and finalized"
        : currentStatus === "failed"
        ? transaction.errorMessage || "Transaction failed"
        : rpcTimeoutOccurred
        ? "RPC network busy - continuing to poll"
        : "Awaiting network confirmation"
    });
  } catch (err) {
    console.error(`[transactionController/status] ❌ Error: ${String(err?.message || err)}`);
    return res.status(500).json({
      success: false,
      error: "Failed to check transaction status",
      details: String(err?.message || err)
    });
  }
}

export default { send, history, status };
