export function formatAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(6).replace(/\.?0+$/, "") : "0";
}

export function buildNanoUri(address, amount) {
  const safeAddress = String(address || "").trim();
  if (!safeAddress) return "";

  const safeAmount = String(amount || "").trim();
  return safeAmount
    ? `nano:${safeAddress}?amount=${encodeURIComponent(safeAmount)}`
    : `nano:${safeAddress}`;
}

