/**
 * =============================================================================
 * NANO RPC CLIENT - PRODUCTION SAFETY RULES ENFORCED
 * =============================================================================
 * 
 * SAFETY RULES:
 * ✅ NEVER expose private keys or seeds
 * ✅ NEVER crash backend on RPC failure
 * ✅ NEVER trust single RPC node (multi-node failover)
 * ✅ ALWAYS normalize responses
 * ✅ ALWAYS treat "account not found" as valid state (balance = 0)
 * ✅ ALWAYS fallback to next RPC node on error
 * ✅ ALWAYS use timeouts (10s per node)
 * ✅ ALWAYS validate JSON before parsing
 * ✅ NEVER use response.json() (use response.text() + manual parse)
 * ✅ NO experimental or unstable RPC nodes
 * 
 * =============================================================================
 */

const DEFAULT_RPC_ENDPOINTS = [
  "https://proxy.nanos.cc/proxy",
  "https://rpc.nano.to"
];

function getRpcEndpoints() {
  const fromEnv = String(process.env.RPC_URL || "").trim();
  const endpoints = (fromEnv ? [fromEnv, ...DEFAULT_RPC_ENDPOINTS] : DEFAULT_RPC_ENDPOINTS).filter(
    Boolean
  );

  // De-dupe while preserving order
  return [...new Set(endpoints)];
}

async function fetchWithTimeout(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal
    });

    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(text) {
  if (typeof text !== "string") return { ok: false, value: null };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, value: null };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * callRpc(payload)
 *
 * - Tries multiple endpoints sequentially.
 * - Uses fetch + AbortController timeout.
 * - Uses response.text() and safe JSON.parse (never response.json()).
 * - Normalizes output.
 * - Handles "Account not found" gracefully as a valid state (balance = 0).
 */
async function callRpc(payload) {
  let body;
  try {
    body = JSON.stringify(payload);
  } catch (err) {
    return {
      success: false,
      source: null,
      data: null,
      error: "Invalid RPC payload JSON"
    };
  }

  const endpoints = getRpcEndpoints();
  const timeoutMs = 10_000;

  for (const url of endpoints) {
    try {
      const { ok, status, text } = await fetchWithTimeout(url, body, timeoutMs);

      if (!text || !String(text).trim()) {
        console.warn(`[rpcClient] Empty RPC response from ${url}`);
        continue;
      }

      const parsed = safeJsonParse(text);
      if (!parsed.ok) {
        console.warn(`[rpcClient] Invalid JSON from ${url} (status ${status})`);
        continue;
      }

      if (!ok) {
        console.warn(`[rpcClient] Non-2xx from ${url} (status ${status})`);
        continue;
      }

      // Nano RPC uses { error: "..." } for application-level errors.
      if (parsed.value && typeof parsed.value === "object" && parsed.value.error) {
        const errorMsg = String(parsed.value.error || "");
        
        // CRITICAL: "Account not found" is NOT an error in Nano.
        // It means the account is uninitialized (frontier/balance = 0).
        // Treat it as success with balance = 0.
        if (errorMsg.toLowerCase().includes("account not found")) {
          return {
            success: true,
            source: url,
            data: {
              account_not_found: true,
              balance: "0",
              pending: "0",
              error: errorMsg
            },
            error: null
          };
        }

        console.warn(
          `[rpcClient] RPC error from ${url}: ${errorMsg}`
        );
        continue;
      }

      return {
        success: true,
        source: url,
        data: parsed.value,
        error: null
      };
    } catch (err) {
      const msg = String(err?.message || err);
      console.warn(`[rpcClient] RPC node failed ${url}: ${msg}`);
      continue;
    }
  }

  return {
    success: false,
    source: null,
    data: null,
    error: "All RPC nodes failed"
  };
}

module.exports = { callRpc };

