/**
 * =============================================================================
 * NANO RPC CLIENT - PRODUCTION READY WITH FAILOVER
 * =============================================================================
 * 
 * SAFETY CRITICAL:
 * ✅ NEVER expose private keys
 * ✅ NEVER crash on RPC failure
 * ✅ ALWAYS use multiple RPC nodes with failover
 * ✅ ALWAYS treat "Account not found" as valid state (balance = 0)
 * ✅ ALWAYS validate JSON before parsing
 * ✅ NEVER use response.json() (use response.text())
 * ✅ SKIP slow/invalid nodes automatically
 * ✅ Track node health for better failover
 * 
 * =============================================================================
 */

const DEFAULT_RPC_NODES = [
  "https://rpc.nano.to",
  "https://proxy.nanos.cc/proxy",
  "https://node.somenano.com/proxy"
];

const RPC_NODES = (process.env.RPC_NODES || DEFAULT_RPC_NODES.join(","))
  .split(",")
  .map((value) => String(value || "").trim())
  .filter(Boolean);

const nodeHealth = {};
RPC_NODES.forEach((node) => {
  nodeHealth[node] = {
    failures: 0,
    successes: 0,
    lastFailTime: null
  };
});

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 30000; // Try failed nodes again after 30s
const RPC_TIMEOUT_MS = Math.max(Number(process.env.RPC_TIMEOUT_MS || 10000), 1000);

const fetchImpl =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

/**
 * Check if a node should be attempted based on health
 */
function isNodeHealthy(url) {
  const health = nodeHealth[url];
  if (!health) return true;

  // If node hit failure threshold, wait before retrying
  if (health.failures >= FAILURE_THRESHOLD && health.lastFailTime) {
    const timeSinceFailure = Date.now() - health.lastFailTime;
    if (timeSinceFailure < RECOVERY_TIME_MS) {
      return false; // Node is in cooldown
    }
    // Reset after cooldown
    health.failures = 0;
    health.lastFailTime = null;
  }

  return true;
}

/**
 * Record node success
 */
function recordSuccess(url) {
  if (nodeHealth[url]) {
    nodeHealth[url].successes++;
    nodeHealth[url].failures = 0; // Reset failure counter
    nodeHealth[url].lastFailTime = null;
  }
}

/**
 * Record node failure
 */
function recordFailure(url) {
  if (nodeHealth[url]) {
    nodeHealth[url].failures++;
    nodeHealth[url].lastFailTime = Date.now();
  }
}

/**
 * Get node health status (for demo)
 */
function getNodeHealth() {
  return Object.entries(nodeHealth).map(([url, health]) => ({
    url,
    healthy: isNodeHealthy(url),
    failures: health.failures,
    successes: health.successes
  }));
}

/**
 * callRpc(payload)
 * 
 * Tries each healthy RPC node sequentially with failover.
 * CRITICAL: Returns raw response data with minimal interpretation.
 * Caller (rpc function in nano.js) decides success based on response content.
 * 
 * Returns: { success, data, source, error } OR { success, exists: false, source, error: null }
 */
async function callRpc(payload) {
  const RPC_TIMEOUT = 15000;

  // Sort nodes by health (healthy nodes first)
  const sortedNodes = RPC_NODES.slice().sort((a, b) => {
    const aHealthy = isNodeHealthy(a);
    const bHealthy = isNodeHealthy(b);
    if (aHealthy === bHealthy) {
      // If same health, prefer more successes
      return nodeHealth[b].successes - nodeHealth[a].successes;
    }
    return aHealthy ? -1 : 1;
  });

  const errors = [];

  for (const url of sortedNodes) {
    // Skip unhealthy nodes
    if (!isNodeHealthy(url)) {
      const health = nodeHealth[url];
      const cooldownRemaining = RECOVERY_TIME_MS - (Date.now() - health.lastFailTime);
      console.warn(`[rpcClient] Skipping ${url} (in cooldown for ${Math.ceil(cooldownRemaining / 1000)}s)`);
      continue;
    }

    try {
      console.log(`[rpcClient] Attempting: ${url}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        timeout: RPC_TIMEOUT
      });

      clearTimeout(timeout);

      const text = await res.text();

      // Skip empty responses
      if (!text || text.trim() === "") {
        console.warn(`[rpcClient] Empty response from: ${url}`);
        recordFailure(url);
        errors.push({ node: url, error: "Empty response" });
        continue;
      }

      // Reject HTML responses (usually error pages)
      if (text.includes("<html")) {
        console.warn(`[rpcClient] HTML response from: ${url}`);
        recordFailure(url);
        errors.push({ node: url, error: "HTML response (possible service error)" });
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn(`[rpcClient] Invalid JSON from: ${url}`);
        recordFailure(url);
        errors.push({ node: url, error: "Invalid JSON response" });
        continue;
      }

      // CRITICAL FIX: Don't require success field - just check for errors in the response
      // Let the caller (rpc function) decide if this is success/pending/failure
      
      // Special case: Account not found is valid state
      if (data.error && data.error.includes("Account not found")) {
        console.log(`✅ RPC success (account not found): ${url}`);
        recordSuccess(url);
        return {
          success: true,
          data: null,
          exists: false,
          source: url,
          error: null
        };
      }

      // If response has explicit error AND is not a valid response, skip node
      if (data.error) {
        console.warn(`[rpcClient] RPC error from ${url}: ${data.error}`);
        recordFailure(url);
        errors.push({ node: url, error: data.error });
        continue;
      }

      // Successfully got a response - let caller decide if it's success/pending
      console.log(`✅ RPC responded from: ${url}`);
      recordSuccess(url);
      return {
        success: true,
        data,
        source: url,
        error: null
      };

    } catch (err) {
      const errorMsg = String(err?.message || err);
      console.warn(`[rpcClient] Network error from ${url}: ${errorMsg}`);
      recordFailure(url);
      errors.push({ node: url, error: errorMsg });
      continue;
    }
  }

  // ALL NODES FAILED
  console.error(`[rpcClient] ❌ All RPC nodes failed after retries`);
  console.error(`[rpcClient] Node errors:`, errors);
  
  return {
    success: false,
    data: null,
    source: null,
    error: "All RPC nodes failed",
    nodeErrors: errors
  };
}

async function testRpcNodes() {
  return Promise.all(
    RPC_NODES.map(async (url) => {
      const result = {
        node: url,
        online: false,
        status_code: null,
        response_time_ms: null,
        version: null,
        error: null
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
      const startTime = Date.now();

      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "version" }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        result.status_code = res.status;
        result.response_time_ms = Date.now() - startTime;
        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {}

        result.online = res.ok && data && !data.error;
        result.version = (data?.node_vendor || data?.version || null) ?? null;
        if (!result.online) {
          result.error = data?.error || "Invalid response";
        }
      } catch (err) {
        clearTimeout(timeout);
        result.response_time_ms = Date.now() - startTime;
        result.error = String(err?.message || err);
      }

      return result;
    })
  );
}

module.exports = { callRpc, RPC_NODES, getNodeHealth, testRpcNodes };

