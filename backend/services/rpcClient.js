/**
 * =============================================================================
 * NANO RPC CLIENT - PRODUCTION READY
 * =============================================================================
 * 
 * SAFETY CRITICAL:
 * ✅ NEVER expose private keys
 * ✅ NEVER crash on RPC failure
 * ✅ ALWAYS use multiple RPC nodes
 * ✅ ALWAYS treat "Account not found" as balance = 0 (valid state)
 * ✅ ALWAYS validate JSON before parsing
 * ✅ NEVER use response.json() (use response.text())
 * ✅ NO unstable RPC nodes (only proven nodes)
 * 
 * =============================================================================
 */

const RPC_NODES = [
  "https://proxy.nanos.cc/proxy",
  "https://rpc.nano.to"
];

/**
 * callRpc(payload)
 * 
 * Tries each RPC node sequentially until success.
 * CRITICAL: Treats "Account not found" as valid state (balance = 0).
 * Returns structured response: { success, data, source, error }
 */
async function callRpc(payload) {
  for (const url of RPC_NODES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const text = await res.text();

      // skip empty responses
      if (!text || text.trim() === "") {
        console.warn("[rpcClient] Empty response from:", url);
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn("[rpcClient] Invalid JSON from:", url);
        continue;
      }

      // 🔥 CRITICAL FIX — HANDLE ACCOUNT NOT FOUND
      if (data.error && data.error.includes("Account not found")) {
        return {
          success: true,
          exists: false,
          balance: "0",
          source: url,
          data: null,
          error: null
        };
      }

      // handle real RPC errors (skip node)
      if (data.error) {
        console.warn("[rpcClient] RPC error from", url, ":", data.error);
        continue;
      }

      // success
      return {
        success: true,
        data,
        source: url,
        error: null
      };

    } catch (err) {
      console.warn("[rpcClient] Network failure from:", url, err.message);
      continue;
    }
  }

  return {
    success: false,
    data: null,
    source: null,
    error: "All RPC nodes failed"
  };
}

module.exports = { callRpc };

