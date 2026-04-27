/**
 * =============================================================================
 * NANO WALLET WRAPPER SERVICE - PRODUCTION READY
 * =============================================================================
 * 
 * High-level wallet operations that handle:
 * ✅ Structured error responses with classification
 * ✅ Account balance queries with proper "not found" handling
 * ✅ Auto-receive block generation
 * ✅ Transaction confirmation monitoring
 * ✅ Demo-ready logging
 * 
 * =============================================================================
 */

import { callRpc } from "./rpcClient.js";
import { rawToNano, nanoToRaw, sendFromWallet, waitForConfirmation, generateReceiveBlock, ERROR_TYPES, getBlockInfo } from "./nano.js";

/**
 * Get account balance with proper handling of new accounts
 * Returns wallet state: not_activated | needs_funding | ready
 */
async function getBalance(account) {
  const acct = String(account || "").trim();
  if (!acct) {
    return { success: false, balance: "0", exists: false, state: "failed", error: "Account is required" };
  }

  try {
    const result = await callRpc({ action: "account_balance", account: acct });

    if (!result.success) {
      return {
        success: false,
        balance: "0",
        pending: "0",
        exists: false,
        state: "failed",
        error: result.error || "RPC failure",
        source: result.source || null
      };
    }

    if (result.exists === false || result.data?.error === "Account not found") {
      return {
        success: true,
        balance: "0",
        pending: "0",
        exists: false,
        state: "not_activated",
        balanceNano: "0",
        pendingNano: "0",
        error: null,
        source: result.source || null,
        message: "Account not yet activated"
      };
    }

    const balanceRaw = String(result.data?.balance || "0");
    const pendingRaw = String(result.data?.pending || "0");
    const balanceNano = rawToNano(balanceRaw);
    const pendingNano = rawToNano(pendingRaw);
    const state = BigInt(balanceRaw) > 0n ? "ready" : "needs_funding";

    return {
      success: true,
      balance: balanceRaw,
      pending: pendingRaw,
      balanceNano,
      pendingNano,
      exists: true,
      state,
      error: null,
      source: result.source || null
    };
  } catch (err) {
    return {
      success: false,
      balance: "0",
      pending: "0",
      exists: false,
      state: "failed",
      error: String(err?.message || err),
      source: null
    };
  }
}

/**
 * Check transaction confirmation status
 */
async function confirmTransaction(hash) {
  const txHash = String(hash || "").trim();
  if (!txHash) {
    return {
      success: false,
      status: "invalid_input",
      error: "Hash is required"
    };
  }

  try {
    const result = await callRpc({ action: "block_info", hash: txHash });
    if (!result.success) {
      return {
        success: false,
        status: "rpc_failed",
        error: result.error || "RPC failure",
        source: result.source || null
      };
    }

    const confirmed =
      result.data?.confirmed === true ||
      result.data?.confirmed === "true" ||
      result.data?.receipt?.confirmed === true ||
      result.data?.receipt?.confirmed === "true";

    return {
      success: true,
      status: confirmed ? "confirmed" : "pending",
      hash: txHash,
      confirmed,
      info: result.data,
      source: result.source || null
    };
  } catch (err) {
    return {
      success: false,
      status: "rpc_failed",
      error: String(err?.message || err),
      source: null
    };
  }
}

/**
 * Send Nano with wallet state checking
 * Returns { success, tx_hash, state, message, ... }
 * Throws on validation errors only
 * 
 * Wallet states returned:
 * - ready: Account funded and ready to send
 * - needs_funding: Account exists but has 0 balance
 * - not_activated: Account doesn't exist yet
 * - processing: Transaction submitted, awaiting confirmation
 * - failed: RPC or signing error occurred
 */
async function sendNano({ privateKey, fromAddress, toAddress, amountNano }) {
  const to = String(toAddress || "").trim();
  const from = String(fromAddress || "").trim();
  
  if (!privateKey) throw { status: ERROR_TYPES.INVALID_INPUT, error: "Missing private key" };
  if (!from) throw { status: ERROR_TYPES.INVALID_INPUT, error: "Missing sender address" };
  if (!to) throw { status: ERROR_TYPES.INVALID_INPUT, error: "Missing recipient address" };

  let amountRaw;
  try {
    amountRaw = nanoToRaw(amountNano);
  } catch (err) {
    throw { 
      status: ERROR_TYPES.INVALID_INPUT, 
      error: String(err?.message || err) 
    };
  }

  console.log(`[sendNano] 🚀 Initiating send: ${amountNano} XNO (${amountRaw} raw)`);
  console.log(`[sendNano] From: ${from}`);
  console.log(`[sendNano] To: ${to}`);

  // STEP 3: Check wallet state BEFORE attempting send
  try {
    const balanceResult = await getBalance(from);
    
    if (!balanceResult.success) {
      console.error(`[sendNano] ❌ Cannot check balance: ${balanceResult.error}`);
      throw {
        status: ERROR_TYPES.RPC_FAILED,
        error: `Failed to check wallet balance: ${balanceResult.error}`,
        state: "failed"
      };
    }

    // Check wallet states
    if (balanceResult.state === "not_activated") {
      console.error(`[sendNano] ❌ Account not activated`);
      throw {
        status: ERROR_TYPES.ACCOUNT_NOT_OPENED,
        error: "Your wallet has not been activated yet. Please receive Nano first.",
        state: "not_activated",
        balance: "0"
      };
    }

    if (balanceResult.state === "needs_funding") {
      console.error(`[sendNano] ❌ Insufficient balance`);
      throw {
        status: ERROR_TYPES.INSUFFICIENT_BALANCE,
        error: "Your wallet has insufficient balance. Send some Nano to your wallet first.",
        state: "needs_funding",
        balance: balanceResult.balance,
        balanceNano: "0"
      };
    }

    // Check if amount is actually available
    const availableRaw = BigInt(balanceResult.balance || "0");
    const requestedRaw = BigInt(amountRaw);

    if (requestedRaw > availableRaw) {
      console.error(`[sendNano] ❌ Insufficient balance for amount. Have: ${availableRaw}, Need: ${requestedRaw}`);
      throw {
        status: ERROR_TYPES.INSUFFICIENT_BALANCE,
        error: `Insufficient balance. Have ${balanceResult.balanceNano} XNO, need ${amountNano} XNO.`,
        state: "needs_funding",
        balance: balanceResult.balance,
        balanceNano: balanceResult.balanceNano,
        amount: amountRaw,
        amountNano
      };
    }

    // State is ready - proceed with send
    console.log(`[sendNano] ✅ Wallet state: ready (balance: ${balanceResult.balanceNano} XNO)`);

  } catch (balanceErr) {
    // Re-throw balance check errors with state
    if (balanceErr && typeof balanceErr === "object" && balanceErr.status) {
      throw balanceErr;
    }
    throw {
      status: ERROR_TYPES.RPC_FAILED,
      error: String(balanceErr?.message || balanceErr),
      state: "failed"
    };
  }

  try {
    // Send the transaction (will throw structured error on failure)
    const result = await sendFromWallet({ 
      privateKey, 
      fromAddress: from, 
      toAddress: to,
      amountRaw 
    });

    const txHash = result.txHash;
    console.log(`[sendNano] ✅ Block broadcasted successfully`);
    console.log(`[sendNano] Transaction hash: ${txHash}`);

    // Wait for confirmation (non-blocking)
    let confirmationInfo = null;
    try {
      const confirmation = await waitForConfirmation(txHash);
      confirmationInfo = {
        confirmed: confirmation.confirmed,
        pending: confirmation.pending,
        confirmationTime: confirmation.confirmationTime,
        message: confirmation.message
      };

      if (confirmation.confirmed) {
        console.log(`[sendNano] ✅ Transaction confirmed`);
      } else {
        console.log(`[sendNano] ⏳ Confirmation pending - will complete shortly`);
      }
    } catch (confirmErr) {
      console.warn(`[sendNano] ⚠️ Confirmation check failed: ${String(confirmErr?.message || confirmErr)}`);
    }

    // STEP 4: Return processing state until confirmed
    return {
      success: true,
      state: confirmationInfo?.confirmed ? "ready" : "processing",
      tx_hash: txHash,
      message: confirmationInfo?.confirmed ? "Payment confirmed" : "Transaction submitted successfully",
      warning: result.warning || null,
      confirmation: confirmationInfo
    };

  } catch (err) {
    // sendFromWallet throws structured error objects
    const isStructured = err && typeof err === "object" && err.status;
    
    console.error(`[sendNano] ❌ Send failed`);
    
    if (isStructured) {
      console.error(`[sendNano] Status: ${err.status}`);
      console.error(`[sendNano] Error: ${err.error}`);
      if (err.balance) console.error(`[sendNano] Balance: ${err.balance} raw (${err.balanceNano || 'unknown'} XNO)`);
    } else {
      console.error(`[sendNano] Error: ${String(err?.message || err)}`);
    }

    // Map error status to wallet state
    let walletState = "failed";
    if (isStructured) {
      if (err.status === ERROR_TYPES.ACCOUNT_NOT_OPENED) {
        walletState = "not_activated";
      } else if (err.status === ERROR_TYPES.INSUFFICIENT_BALANCE) {
        walletState = "needs_funding";
      } else {
        walletState = "failed";
      }
      
      if (err.state) {
        walletState = err.state; // Use explicit state if provided
      }
    }
    
    throw {
      ...err,
      state: walletState,
      error: err.error || String(err?.message || err)
    };
  }
}

/**
 * PHASE 3: AUTO-RECEIVE - Automatically receive pending funds
 * This ensures wallet is usable after first deposit
 */
async function autoReceive({ privateKey, account, sourceHash }) {
  if (!privateKey || !account || !sourceHash) {
    console.log(`[autoReceive] Missing parameters - skipping auto-receive`);
    return { success: false, message: "Missing parameters" };
  }

  try {
    console.log(`[autoReceive] 🔄 Checking for pending funds...`);
    
    const balance = await getBalance(account);
    if (!balance.pending || balance.pending === "0") {
      console.log(`[autoReceive] No pending funds`);
      return { success: false, message: "No pending funds" };
    }

    console.log(`[autoReceive] Pending: ${balance.pendingNano} XNO. Generating receive block...`);
    
    const result = await generateReceiveBlock({
      privateKey,
      accountAddress: account,
      sourceHash
    });

    console.log(`[autoReceive] ✅ Receive block created: ${result.hash}`);
    return {
      success: true,
      hash: result.hash,
      type: result.type,
      message: `Received ${balance.pendingNano} XNO`
    };

  } catch (err) {
    console.warn(`[autoReceive] ⚠️ Auto-receive failed: ${String(err?.message || err)}`);
    return {
      success: false,
      error: String(err?.message || err),
      message: "Auto-receive failed but funds are safe"
    };
  }
}

/**
 * Confirm a transaction with detailed status
 */
async function pollConfirmation(txHash, maxAttempts = 20, delayMs = 500) {
  console.log(`[pollConfirmation] Polling for confirmation: ${txHash}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await confirmTransaction(txHash);
      if (result.success && result.confirmed) {
        console.log(`[pollConfirmation] ✅ Confirmed after ${(i + 1) * delayMs}ms`);
        return {
          success: true,
          confirmed: true,
          confirmationTime: (i + 1) * delayMs
        };
      }
      
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      console.warn(`[pollConfirmation] Poll attempt ${i + 1} failed: ${String(err?.message || err)}`);
    }
  }

  return {
    success: true,
    confirmed: false,
    pending: true,
    message: "Transaction pending - still processing"
  };
}

export {
  getBalance,
  sendNano,
  confirmTransaction,
  autoReceive,
  pollConfirmation
};

