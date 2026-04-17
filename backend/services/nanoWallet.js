/**
 * =============================================================================
 * NANO WALLET SERVICE - PRODUCTION SAFETY RULES ENFORCED
 * =============================================================================
 * 
 * SAFETY RULES:
 * ✅ NEVER expose private keys in responses
 * ✅ ALWAYS handle "Account not found" as valid state (balance = 0)
 * ✅ ALWAYS normalize response structure: { success, tx_hash, source, error }
 * ✅ ALWAYS fail gracefully without crashing backend
 * ✅ STRICT: Never trust single RPC node
 * ✅ NEW ACCOUNTS: Treated properly (no balance = account doesn't exist yet)
 * 
 * =============================================================================
 */

const { callRpc } = require("./rpcClient");
const { rawToNano, nanoToRaw, sendFromWallet, waitForConfirmation } = require("./nano");

function normalize(result) {
  if (!result || typeof result !== "object") {
    return { success: false, data: null, error: "Invalid RPC result", source: null };
  }
  return {
    success: Boolean(result.success),
    data: result.success ? result.data : null,
    error: result.success ? null : String(result.error || "RPC error"),
    source: result.source || null
  };
}

async function getBalance(account) {
  const acct = String(account || "").trim();
  if (!acct) {
    return { success: false, balance: "0", exists: false, error: "Account is required" };
  }

  const result = await callRpc({ action: "account_balance", account: acct });
  
  // CRITICAL: Handle "Account not found" as valid state (returns exists: false)
  if (result.success && result.exists === false) {
    return {
      success: true,
      balance: "0",
      exists: false,
      error: null
    };
  }

  if (!result.success) {
    return {
      success: false,
      balance: "0",
      exists: false,
      error: result.error || "RPC failure"
    };
  }

  // Account exists with balance data
  const balanceRaw = String(result.data?.balance || "0");
  const pendingRaw = String(result.data?.pending || "0");

  return {
    success: true,
    balance: balanceRaw,
    pending: pendingRaw,
    balanceNano: rawToNano(balanceRaw),
    pendingNano: rawToNano(pendingRaw),
    exists: true,
    error: null
  };
}

async function confirmTransaction(hash) {
  const txHash = String(hash || "").trim();
  if (!txHash) {
    return { success: false, data: null, error: "Hash is required", source: null };
  }

  const result = await callRpc({ action: "block_info", hash: txHash });
  if (!result.success) return normalize(result);

  const confirmed = result.data?.confirmed === true || result.data?.confirmed === "true";
  return {
    success: true,
    source: result.source || null,
    error: null,
    data: {
      hash: txHash,
      confirmed,
      info: result.data
    }
  };
}

/**
 * sendNano
 *
 * NOTE: This function does not accept seeds from clients. It is intended to be
 * used with server-side stored keys (e.g. authenticated user wallets).
 * 
 * Returns: { success, tx_hash, source, error }
 */
async function sendNano({ privateKey, fromAddress, toAddress, amountNano }) {
  const to = String(toAddress || "").trim();
  const from = String(fromAddress || "").trim();
  if (!privateKey) return { success: false, tx_hash: null, source: null, error: "Missing privateKey" };
  if (!from) return { success: false, tx_hash: null, source: null, error: "Missing fromAddress" };
  if (!to) return { success: false, tx_hash: null, source: null, error: "Missing toAddress" };

  let amountRaw;
  try {
    amountRaw = nanoToRaw(amountNano);
  } catch (err) {
    return { success: false, tx_hash: null, source: null, error: String(err?.message || err) };
  }

  try {
    const { txHash } = await sendFromWallet({ privateKey, fromAddress: from, toAddress: to, amountRaw });
    const confirmation = await waitForConfirmation(txHash).catch((e) => ({ confirmed: false, error: e }));

    return {
      success: true,
      tx_hash: txHash,
      source: null,
      error: null,
      confirmed: Boolean(confirmation?.confirmed),
      confirmedAt: confirmation?.confirmedAt || null
    };
  } catch (err) {
    return { success: false, tx_hash: null, source: null, error: "Failed to process Nano transaction" };
  }
}

module.exports = {
  getBalance,
  sendNano,
  confirmTransaction
};

