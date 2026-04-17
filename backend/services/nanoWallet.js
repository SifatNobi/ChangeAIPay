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
    return { success: false, data: null, error: "Account is required", source: null };
  }

  const result = await callRpc({ action: "account_balance", account: acct });
  if (!result.success) return normalize(result);

  const balanceRaw = String(result.data?.balance || "0");
  const pendingRaw = String(result.data?.pending || "0");

  return {
    success: true,
    source: result.source || null,
    error: null,
    data: {
      account: acct,
      balanceRaw,
      pendingRaw,
      balanceNano: rawToNano(balanceRaw),
      pendingNano: rawToNano(pendingRaw)
    }
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
 */
async function sendNano({ privateKey, fromAddress, toAddress, amountNano }) {
  const to = String(toAddress || "").trim();
  const from = String(fromAddress || "").trim();
  if (!privateKey) return { success: false, data: null, error: "Missing privateKey", source: null };
  if (!from) return { success: false, data: null, error: "Missing fromAddress", source: null };
  if (!to) return { success: false, data: null, error: "Missing toAddress", source: null };

  let amountRaw;
  try {
    amountRaw = nanoToRaw(amountNano);
  } catch (err) {
    return { success: false, data: null, error: String(err?.message || err), source: null };
  }

  try {
    const { txHash } = await sendFromWallet({ privateKey, fromAddress: from, toAddress: to, amountRaw });
    const confirmation = await waitForConfirmation(txHash).catch((e) => ({ confirmed: false, error: e }));

    return {
      success: true,
      source: null,
      error: null,
      data: {
        txHash,
        confirmed: Boolean(confirmation?.confirmed),
        confirmedAt: confirmation?.confirmedAt || null
      }
    };
  } catch (err) {
    return { success: false, data: null, error: "Failed to process Nano transaction", source: null };
  }
}

module.exports = {
  getBalance,
  sendNano,
  confirmTransaction
};

