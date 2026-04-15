const axios = require("axios");

function requireRpcUrl() {
  const url = process.env.RPC_URL;
  if (!url) {
    const err = new Error("Missing RPC_URL");
    err.statusCode = 500;
    throw err;
  }
  return url;
}

async function rpc(action, params = {}) {
  const url = requireRpcUrl();
  const { data } = await axios.post(url, { action, ...params }, { timeout: 15000 });
  if (data && data.error) {
    const err = new Error(String(data.error));
    err.rpcError = data.error;
    err.statusCode = 502;
    throw err;
  }
  return data;
}

function nanoToRaw(nanoAmountStr) {
  const s = String(nanoAmountStr || "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount format");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 30) throw new Error("Too many decimals (max 30)");

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
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

async function createWalletAndAccount() {
  const walletRes = await rpc("wallet_create");
  const wallet = walletRes.wallet;
  if (!wallet) throw new Error("Nano RPC did not return wallet");

  const acctRes = await rpc("account_create", { wallet });
  const account = acctRes.account;
  if (!account) throw new Error("Nano RPC did not return account");

  return { walletId: wallet, address: account };
}

async function getAccountBalance(address) {
  const res = await rpc("account_balance", { account: address });
  const balanceRaw = res.balance || "0";
  const pendingRaw = res.pending || "0";
  return {
    balanceRaw,
    pendingRaw,
    balanceNano: rawToNano(balanceRaw),
    pendingNano: rawToNano(pendingRaw)
  };
}

async function sendFromWallet({ walletId, fromAddress, toAddress, amountRaw }) {
  const res = await rpc("send", {
    wallet: walletId,
    source: fromAddress,
    destination: toAddress,
    amount: amountRaw
  });
  const block = res.block;
  if (!block) throw new Error("Nano RPC did not return block hash");
  return { txHash: block };
}

module.exports = {
  rpc,
  nanoToRaw,
  rawToNano,
  createWalletAndAccount,
  getAccountBalance,
  sendFromWallet
};

