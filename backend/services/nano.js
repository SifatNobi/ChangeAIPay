const axios = require("axios");
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

function getAxiosConfig() {
  const config = {
    headers: { "Content-Type": "application/json" },
    timeout: Number(process.env.RPC_TIMEOUT_MS || 15000)
  };

  const token = String(process.env.RPC_AUTH_TOKEN || "").trim();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const username = String(process.env.RPC_BASIC_USER || "").trim();
  const password = String(process.env.RPC_BASIC_PASS || "").trim();
  if (username && password) {
    config.auth = { username, password };
  }

  return config;
}

function getRpcUrl() {
  let rpcUrl = String(process.env.RPC_URL || "").trim();
  if (!rpcUrl) {
    const err = new Error("Nano RPC is not configured. Set RPC_URL for wallet and transfer features.");
    err.code = "RPC_NOT_CONFIGURED";
    throw err;
  }

  // Support common user-provided shorthand for nano.to.
  // nano.to exposes the public RPC at https://rpc.nano.to.
  if (/nano\.to\/rpc$/i.test(rpcUrl)) {
    rpcUrl = "https://rpc.nano.to";
  }

  return rpcUrl;
}

async function rpc(action, payload = {}) {
  const rpcUrl = getRpcUrl();
  const rpcApiKey = String(process.env.RPC_API_KEY || "").trim();
  const response = await axios.post(
    rpcUrl,
    {
      action,
      ...payload,
      ...(rpcApiKey ? { key: rpcApiKey } : {})
    },
    getAxiosConfig()
  );

  if (response.data?.error) {
    throw new Error(`Nano RPC ${action} failed: ${response.data.error}`);
  }

  return response.data;
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