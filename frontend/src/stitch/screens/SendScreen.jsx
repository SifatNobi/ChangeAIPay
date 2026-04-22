import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../../api";

export default function SendScreen({ sendTransaction }) {
  const [form, setForm] = useState({ recipient: "", amount: "" });
  const [status, setStatus] = useState({ type: "idle", message: "", txHash: null });
  const [loading, setLoading] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [permissionState, setPermissionState] = useState("idle");
  const scannerRef = useRef(null);
  
  // PHASE 11: Real-time confirmation polling
  const [txId, setTxId] = useState(null);
  const [confirmationTime, setConfirmationTime] = useState(0);
  const pollIntervalRef = useRef(null);
  const pollStartTimeRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const pollErrorCountRef = useRef(0);
  const maxPollTime = 120000; // 2 minutes max polling
  const maxPollErrors = 5; // Max network errors before giving up

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // PHASE 11: Poll transaction status for confirmations with network resilience
  async function pollTransactionStatus(id) {
    const elapsed = Math.floor((Date.now() - pollStartTimeRef.current) / 1000);
    pollAttemptsRef.current += 1;

    // CRITICAL: Stop polling after 2 minutes (max confirmation time)
    if (elapsed > 120) {
      console.warn(`[SendScreen] ⏱️ Max polling time reached (${elapsed}s). Stopping.`);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    try {
      const token = localStorage.getItem("changeaipay_token") || localStorage.getItem("token");
      if (!token) {
        console.warn("[SendScreen] ⚠️ Auth token lost. Stopping polling.");
        stopPolling();
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per request

      const response = await fetch(`${API_BASE_URL}/transaction/${id}/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Network error or timeout
      if (!response.ok) {
        pollErrorCountRef.current += 1;
        
        if (response.status === 404) {
          // Transaction not found in DB (shouldn't happen)
          console.error("[SendScreen] ❌ Transaction not found on backend");
          setStatus({
            type: "error",
            message: "Transaction record not found. Please contact support.",
            txHash: null
          });
          stopPolling();
          return;
        }

        if (response.status === 401 || response.status === 403) {
          // Auth failure
          console.warn("[SendScreen] ⚠️ Authentication failed. Stopping polls.");
          stopPolling();
          return;
        }

        // Other server errors - continue polling but track
        if (pollErrorCountRef.current >= maxPollErrors) {
          console.error(`[SendScreen] ❌ Too many polling errors (${pollErrorCountRef.current}). Stopping.`);
          setStatus({
            type: "pending",
            message: `ℹ️ Unable to reach confirmation server. Your payment may still be processing. Check again in a moment. (${elapsed}s)`,
            txHash: status.txHash
          });
          stopPolling();
          return;
        }

        console.warn(`[SendScreen] ⚠️ Status check failed: ${response.status} (${pollErrorCountRef.current}/${maxPollErrors})`);
        return;
      }

      // Reset error counter on successful request
      pollErrorCountRef.current = 0;

      let data;
      try {
        data = await response.json();
      } catch {
        console.warn("[SendScreen] ⚠️ Failed to parse server response");
        return;
      }

      if (!data.success) {
        console.warn(`[SendScreen] Status API error: ${data.error}`);
        return;
      }

      setConfirmationTime(elapsed);
      console.log(`[SendScreen] Status: ${data.status}, confirmed: ${data.confirmed} (attempt ${pollAttemptsRef.current})`);

      // Handle confirmed state
      if (data.confirmed) {
        setStatus({
          type: "success",
          message: `✨ Payment Confirmed (${elapsed}s)`,
          txHash: data.tx_hash,
          confirmed: true
        });
        stopPolling();
        return;
      }

      // Handle failed state
      if (data.status === "failed") {
        setStatus({
          type: "error",
          message: `❌ ${data.message || "Payment failed"}`,
          txHash: null
        });
        stopPolling();
        return;
      }

      // Still awaiting confirmation
      setStatus({
        type: "pending",
        message: `⏳ Confirming on network (${elapsed}s)...`,
        txHash: data.tx_hash
      });
    } catch (err) {
      if (err.name === "AbortError") {
        pollErrorCountRef.current += 1;
        console.warn(`[SendScreen] ⏱️ Request timeout (${pollErrorCountRef.current}/${maxPollErrors})`);
        
        if (pollErrorCountRef.current >= maxPollErrors) {
          console.error("[SendScreen] ❌ Too many timeouts. Your payment may still be processing.");
          setStatus({
            type: "pending",
            message: `ℹ️ Network slow. Your payment is processing. Try refreshing in 30 seconds.`,
            txHash: status.txHash
          });
          stopPolling();
        }
      } else {
        console.warn(`[SendScreen] Network error: ${err.message}`);
        pollErrorCountRef.current += 1;
        
        if (pollErrorCountRef.current >= maxPollErrors) {
          console.error("[SendScreen] ❌ Network unavailable");
          setStatus({
            type: "pending",
            message: `⚠️ Network connection lost. Waiting for reconnection...`,
            txHash: status.txHash
          });
          stopPolling();
        }
      }
    }
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
    pollErrorCountRef.current = 0;
  }

  // Start polling when transaction sent
  useEffect(() => {
    if (!txId || status.type !== "pending") return;

    console.log(`[SendScreen] 📡 Starting confirmation polling for tx: ${txId}`);
    pollStartTimeRef.current = Date.now();
    pollAttemptsRef.current = 0;
    pollErrorCountRef.current = 0;

    // Poll immediately, then every 2 seconds
    pollTransactionStatus(txId);
    pollIntervalRef.current = setInterval(() => {
      pollTransactionStatus(txId);
    }, 2000);

    return () => {
      stopPolling();
    };
  }, [txId, status.type]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "", txHash: null });
    setTxId(null);
    setConfirmationTime(0);

    try {
      const result = await sendTransaction(form);

      const hasSuccessStatus = result?.status === "success";
      const hasTxHash = Boolean(result?.tx_hash);
      const isFailureStatus = result?.status === "failed";
      const isPendingStatus = result?.status === "pending";

      // CRITICAL YC RULE: If tx_hash exists → show as success with polling
      if (hasTxHash && (hasSuccessStatus || !isFailureStatus)) {
        // Store tx ID for polling
        const txIdFromResponse = result?.transaction?.id || result?.transaction_id;
        if (txIdFromResponse) {
          setTxId(txIdFromResponse);
          console.log(`[SendScreen] Stored tx ID for polling: ${txIdFromResponse}`);
        }

        setStatus({
          type: "success",
          message: "✨ Payment submitted successfully",
          txHash: result.tx_hash
        });
        setForm({ recipient: "", amount: "" });
        setScanError("");

        // Switch to pending/polling state if we have tx ID
        if (txIdFromResponse) {
          setStatus({
            type: "pending",
            message: "⏳ Confirming on network (0s)...",
            txHash: result.tx_hash
          });
        }
      } else if (isPendingStatus) {
        setStatus({
          type: "pending",
          message: result?.message || "Payment processing... Check back in a moment.",
          txHash: result?.tx_hash || null
        });
      } else {
        const errorMsg = result?.error || "Payment failed. Please try again.";
        setStatus({
          type: "error",
          message: errorMsg,
          txHash: null
        });
      }
    } catch (err) {
      const rawMessage = String(err?.message || "Payment failed. Please try again.");
      const needsFunding = /fund|receive|activate|activated|wallet/i.test(rawMessage);

      setStatus({
        type: needsFunding ? "action_required" : "error",
        message: rawMessage,
        txHash: null
      });
    } finally {
      setLoading(false);
    }
  }

  function normalizeScannedText(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    const nativeUri = text.replace(/^nano:/i, "").split("?")[0].trim();
    const walletMatch = nativeUri.match(/nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}/i);
    if (walletMatch) return walletMatch[0];

    const fallbackMatch = text.match(/nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}/i);
    if (fallbackMatch) return fallbackMatch[0];

    return text;
  }

  async function requestCameraAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera access is not supported by this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach((track) => {
      if (track.stop) track.stop();
    });
    return true;
  }

  async function openScanner() {
    if (scanActive || scannerRef.current) return;
    setScanError("");
    setPermissionState("requesting");

    try {
      await requestCameraAccess();
      setPermissionState("granted");
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("qr-scanner");
      scannerRef.current = html5QrCode;
      setScanActive(true);

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 }, showTorchButton: true, rememberLastUsedCamera: true },
        (decodedText) => {
          const recipient = normalizeScannedText(decodedText);
          if (!recipient) {
            setScanError("Scanned QR is not a valid Nano address or payment payload.");
            return;
          }

          setForm((state) => ({ ...state, recipient }));
          setStatus({ type: "success", message: "QR scanned and recipient auto-filled.", txHash: null });
          stopScanner();
        },
        (error) => {
          console.error("QR scanning error:", error);
          setScanError("Error scanning QR code. Please try again.");
        }
      );
    } catch (err) {
      const reason = err?.name === "NotAllowedError" || err?.name === "SecurityError"
        ? "Camera permission denied. Please allow access to scan QR codes."
        : err?.name === "NotFoundError"
        ? "No camera device found."
        : String(err?.message || "Unable to access camera.");

      setScanError(reason);
      setScanActive(false);
      setPermissionState("denied");
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // ignore cleanup failures
    }
    scannerRef.current = null;
    setScanActive(false);
    setPermissionState("idle");
  }

  return (
    <div className="stack-lg stitch-bg stitch-send-screen">
      <section className="card form-card glass-card send-surface stitch-send-card">
        <span className="eyebrow">Quick Transfer</span>
        <h1>Send Nano</h1>
        <p className="muted">Real-time transfer with zero-fee Nano settlement.</p>

        <form onSubmit={submit}>
          <input
            name="recipient"
            onChange={(e) => setForm({ ...form, recipient: e.target.value })}
            placeholder="Recipient (email or Nano address)"
            value={form.recipient}
            required
            disabled={loading}
          />
          <input
            name="amount"
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Amount (XNO)"
            value={form.amount}
            required
            disabled={loading}
          />

          <div className="qr-scan-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={openScanner}
              disabled={loading}
            >
              Scan QR
            </button>
            <span className="muted">Use your camera to autofill a Nano address.</span>
          </div>

          {scanActive && (
            <div className="qr-scanner-container active">
              <div id="qr-scanner" />
              <div className="scanner-caption">
                {permissionState === "requesting" ? "Requesting camera permission..." : "Point your camera at a QR code to scan."}
              </div>
              <button type="button" className="ghost-button" onClick={stopScanner}>
                Stop scanner
              </button>
            </div>
          )}

          {scanError && <div className="status error"><p>{scanError}</p></div>}

          {/* ERROR STATE */}
          {status.type === "error" && (
            <div className="status error">
              <strong>❌ Payment Failed</strong>
              <p>{status.message}</p>
            </div>
          )}

          {status.type === "action_required" && (
            <div className="status action-required">
              <strong>⚠️ Action Required</strong>
              <p>{status.message}</p>
              <p className="muted">
                To continue, receive Nano to your wallet address first. This app does not sell Nano directly.
              </p>
            </div>
          )}
          
          {/* PENDING STATE */}
          {status.type === "pending" && (
            <div className="status pending">
              <strong>⏳ Processing Payment</strong>
              <p>{status.message}</p>
            </div>
          )}
          
          {/* SUCCESS STATE */}
          {status.type === "success" && (
            <div className="status success">
              <strong>✅ Payment Successful</strong>
              <p>{status.message}</p>
              {status.txHash && (
                <p className="tx-hash">
                  Hash: {status.txHash.slice(0, 16)}...
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => navigator.clipboard.writeText(status.txHash)}
                  >
                    Copy
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="trust-note">Powered by Nano network • Instant settlement</div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}

