const axios = require("axios");
const crypto = require("crypto");

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

/**
 * ✅ FULL DEMO SAFE WALLET SYSTEM (NO RPC)
 */
function createWalletAndAccount() {
  console.log("🔥 NEW NANO.JS ACTIVE 🔥");
  return {
    walletId: crypto.randomUUID(),
    address: "nano_" + crypto.randomBytes(20).toString("hex")
  };
}

/**
 * ⚠️ MOCK BALANCE (NO RPC)
 */
async function getAccountBalance() {
  return {
    balanceRaw: "0",
    pendingRaw: "0",
    balanceNano: "0.00",
    pendingNano: "0.00"
  };
}

/**
 * ⚠️ MOCK SEND (NO RPC)
 */
async function sendFromWallet({
  walletId,
  fromAddress,
  toAddress,
  amountRaw
}) {
  return {
    txHash: "MOCK_" + crypto.randomBytes(12).toString("hex")
  };
}

module.exports = {
  nanoToRaw,
  rawToNano,
  createWalletAndAccount,
  getAccountBalance,
  sendFromWallet
};