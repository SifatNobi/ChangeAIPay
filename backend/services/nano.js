const nanocurrency = require("nanocurrency");

function nanoToRaw(nanoAmountStr) {
  const s = String(nanoAmountStr || "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount format");

  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(30)).slice(0, 30);

  const raw = BigInt(whole) * 10n ** 30n + BigInt(fracPadded || "0");
  if (raw <= 0n) throw new Error("Amount must be greater than 0");

  return raw.toString();
}

function rawToNano(rawStr) {
  const raw = BigInt(String(rawStr || "0"));

  const whole = raw / 10n ** 30n;
  const frac = raw % 10n ** 30n;

  const fracStr = frac.toString().padStart(30, "0").replace(/0+$/, "");

  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function getRpcUrl() {
  const rpcUrl = String(process.env.RPC_URL || "").trim();
  if (!rpcUrl) {
    const err = new Error("Nano RPC is not configured. Set RPC_URL for wallet and transfer features.");
    err.code = "RPC_NOT_CONFIGURED";
    throw err;
  }

  return rpcUrl;
}

function getRpcHeaders() {
  const headers = { "Content-Type": "application/json" };

  const token = String(process.env.RPC_AUTH_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

function validateRpcPayload(action, payload) {
  if (!action || typeof action !== "string") {
    throw new Error("Nano RPC action must be a non-empty string");
  }
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Nano RPC payload must be an object");
  }

  const requireField = (name) => {
    if (payload[name] == null || String(payload[name]).trim() === "") {
      throw new Error(`Nano RPC ${action} missing required field: ${name}`);
    }
  };

  // Minimal validation for the actions we use.
  if (action === "account_balance") requireField("account");
  if (action === "account_info") requireField("account");
  if (action === "block_info") requireField("hash");
  if (action === "process") requireField("block");
}

async function rpcFetchWithTimeout(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getRpcHeaders(),
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("RPC request failed with status " + response.status);
    }

    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpc(action, payload = {}) {
  const rpcUrl = getRpcUrl();
  const rpcApiKey = String(process.env.RPC_API_KEY || "").trim();

  const requestPayload = {
    action,
    ...payload,
    ...(rpcApiKey ? { key: rpcApiKey } : {})
  };

  validateRpcPayload(action, requestPayload);

  let body;
  try {
    body = JSON.stringify(requestPayload);
  } catch (err) {
    throw new Error("Nano RPC payload must be valid JSON");
  }

  // Safe debug logging for RPC calls (does not include private keys).
  try {
    console.log("Sending Nano TX payload:", JSON.stringify(requestPayload, null, 2));
  } catch {
    console.log("Sending Nano TX payload: [unserializable]");
  }

  const timeoutMs = Math.max(Number(process.env.RPC_TIMEOUT_MS || 10000), 1000);
  const retries = Math.max(Number(process.env.RPC_RETRIES || 1), 0);

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const data = await rpcFetchWithTimeout(rpcUrl, body, timeoutMs);
      if (data?.error) {
        throw new Error(`Nano RPC ${action} failed: ${data.error}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      console.error("Nano RPC Error:", msg);

      // AbortError / timeout or transient network failures should retry.
      const isAbort = err?.name === "AbortError" || /aborted|timeout/i.test(msg);
      const isNetwork = /network|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(msg);
      if (attempt < retries && (isAbort || isNetwork)) {
        const backoffMs = 250 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      break;
    }
  }

  throw new Error("Failed to process Nano transaction");
}

async function createWalletAndAccount() {
  // `nano.to` doesn't support wallet_create/account_create. We generate per-user keys locally
  // and use RPC only for public reads + broadcasting signed blocks.
  const seed = await nanocurrency.generateSeed();
  const privateKey = nanocurrency.deriveSecretKey(seed, 0);
  const publicKey = nanocurrency.derivePublicKey(privateKey);
  const address = nanocurrency.deriveAddress(publicKey);

  return { privateKey, address };
}

async function getAccountBalance(address) {
  const data = await rpc("account_balance", { account: address });

  return {
    balanceRaw: String(data.balance || "0"),
    pendingRaw: String(data.pending || "0"),
    balanceNano: rawToNano(String(data.balance || "0")),
    pendingNano: rawToNano(String(data.pending || "0"))
  };
}

async function sendFromWallet({ privateKey, fromAddress, toAddress, amountRaw }) {
  if (!privateKey) throw new Error("Missing Nano private key");
  if (!fromAddress) throw new Error("Missing Nano sender address");
  if (!toAddress) throw new Error("Missing Nano recipient address");

  // 1) Read account state (frontier + representative + balance)
  const info = await rpc("account_info", { account: fromAddress });
  const previous = String(info.frontier || "").trim();
  const representative = String(info.representative_block || "").trim();
  const currentBalanceRaw = String(info.balance || "0");

  if (!previous || !representative) {
    throw new Error("Nano RPC account_info missing required fields");
  }

  const nextBalanceRaw = (BigInt(currentBalanceRaw) - BigInt(amountRaw)).toString();
  if (nextBalanceRaw.startsWith("-")) {
    throw new Error("Insufficient balance");
  }

  // 2) Hash + compute PoW locally, then build/sign the send state block
  const blockHash = nanocurrency.hashBlock({
    account: fromAddress,
    previous,
    representative,
    balance: nextBalanceRaw,
    link: toAddress
  });

  const work = await nanocurrency.computeWork(blockHash);
  if (!work) {
    throw new Error("Failed to compute PoW for Nano block");
  }

  const created = nanocurrency.createBlock(privateKey, {
    work,
    previous,
    representative,
    balance: nextBalanceRaw,
    link: toAddress
  });

  // 3) Broadcast via `process` with `subtype: send`
  await rpc("process", {
    json_block: true,
    subtype: "send",
    block: created.block
  });

  return { txHash: created.hash };
}

async function getBlockInfo(txHash) {
  return rpc("block_info", { hash: txHash });
}

async function waitForConfirmation(txHash) {
  const attempts = Math.max(Number(process.env.RPC_CONFIRM_ATTEMPTS || 8), 1);
  const delayMs = Math.max(Number(process.env.RPC_CONFIRM_DELAY_MS || 1500), 250);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const info = await getBlockInfo(txHash);
      const confirmed = info?.confirmed === true || info?.confirmed === "true";
      if (confirmed) {
        return {
          confirmed: true,
          confirmedAt: new Date(),
          info
        };
      }
    } catch (error) {
      if (attempt === attempts - 1) {
        return { confirmed: false, info: null, error };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { confirmed: false, info: null };
}

module.exports = {
  nanoToRaw,
  rawToNano,
  createWalletAndAccount,
  getAccountBalance,
  sendFromWallet,
  waitForConfirmation
};