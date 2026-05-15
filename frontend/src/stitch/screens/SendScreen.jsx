import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../api";
import "../../components/SendStyles.css";

const PAYMENT_STORAGE_KEY = "changeaipay_payment_context";

function loadSavedPaymentContext() {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function savePaymentContext(context) {
  try {
    localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(context));
  } catch {}
}

function clearSavedPaymentContext() {
  try {
    localStorage.removeItem(PAYMENT_STORAGE_KEY);
  } catch {}
}

export default function SendScreen({ sendTransaction, paymentContext: appPaymentContext, onClearContext }) {
  const location = useLocation();
  const [form, setForm] = useState({
    recipient: "",
    amount: "",
    currency: "XNO",
    merchant: "",
    destination: "",
    note: "",
    reference: ""
  });
  const [status, setStatus] = useState({ type: "idle", message: "", txHash: null });
  const [loading, setLoading] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [permissionState, setPermissionState] = useState("idle");
  const [paymentContext, setPaymentContext] = useState(null);
  const [smartWarnings, setSmartWarnings] = useState([]);
  const scannerRef = useRef(null);
  
  // PHASE 11: Real-time confirmation polling
  const [txId, setTxId] = useState(null);
  const [confirmationTime, setConfirmationTime] = useState(0);
  const pollIntervalRef = useRef(null);
  const pollStartTimeRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const pollErrorCountRef = useRef(0);
  const maxPollErrors = 5; // Max network errors before giving up

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

  useEffect(() => {
    const saved = loadSavedPaymentContext();
    const incoming = location.state && Object.keys(location.state).length ? location.state : saved || appPaymentContext;
    if (!incoming) return;

    const normalized = {
      recipient: incoming.recipient || incoming.destination || "",
      amount: incoming.amount != null ? String(incoming.amount) : "",
      currency: incoming.currency || "XNO",
      merchant: incoming.merchant || "",
      destination: incoming.destination || incoming.recipient || "",
      note: incoming.note || "",
      reference: incoming.reference || ""
    };

    setPaymentContext({ ...incoming, ...normalized });
    setForm((prev) => ({
      ...prev,
      ...normalized
    }));
  }, [location.state, appPaymentContext]);

  useEffect(() => {
    const payload = {
      ...paymentContext,
      recipient: form.recipient,
      amount: form.amount,
      currency: form.currency,
      merchant: form.merchant,
      destination: form.destination,
      note: form.note,
      reference: form.reference,
      metadata: paymentContext?.metadata || {}
    };

    if (payload.recipient || payload.amount || payload.destination) {
      savePaymentContext(payload);
    } else {
      clearSavedPaymentContext();
    }
  }, [form, paymentContext]);

  useEffect(() => {
    const warnings = [];
    const amountValue = parseFloat(form.amount || "0");
    if (amountValue > 100) {
      warnings.push("High-value transfer detected. Confirm merchant identity before sending.");
    }
    if (form.currency && form.currency !== "XNO") {
      warnings.push("This payment uses a non-XNO currency. FX conversion may apply.");
    }
    if (form.recipient && !form.merchant) {
      warnings.push("Merchant name missing. Please verify the recipient carefully.");
    }
    setSmartWarnings(warnings);
  }, [form.amount, form.currency, form.merchant, form.recipient]);

  async function pollTransactionStatus(id) {
    const elapsed = Math.floor((Date.now() - pollStartTimeRef.current) / 1000);
    pollAttemptsRef.current += 1;

    if (elapsed > 120) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    try {
      const token = localStorage.getItem("changeaipay_token") || localStorage.getItem("token");
      if (!token) {
        stopPolling();
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${API_BASE_URL}/transaction/${id}/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        pollErrorCountRef.current += 1;
        if (response.status === 404) {
          setStatus({
            type: "error",
            message: "Transaction record not found. Please contact support.",
            txHash: null
          });
          stopPolling();
          return;
        }

        if (response.status === 401 || response.status === 403) {
          stopPolling();
          return;
        }

        if (pollErrorCountRef.current >= maxPollErrors) {
          setStatus({
            type: "pending",
            message: `ℹ️ Unable to reach confirmation server. Your payment may still be processing. Check again in a moment. (${elapsed}s)`,
            txHash: status.txHash
          });
          stopPolling();
          return;
        }

        return;
      }

      pollErrorCountRef.current = 0;
      const data = await response.json();

      if (!data.success) {
        return;
      }

      setConfirmationTime(elapsed);

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

      if (data.status === "failed") {
        setStatus({
          type: "error",
          message: `❌ ${data.message || "Payment failed"}`,
          txHash: null
        });
        stopPolling();
        return;
      }

      setStatus({
        type: "pending",
        message: `⏳ Confirming on network (${elapsed}s)...`,
        txHash: data.tx_hash
      });
    } catch (err) {
      if (err.name === "AbortError") {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= maxPollErrors) {
          setStatus({
            type: "pending",
            message: `ℹ️ Network slow. Your payment is processing. Try refreshing in 30 seconds.`,
            txHash: status.txHash
          });
          stopPolling();
        }
      } else {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= maxPollErrors) {
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

  useEffect(() => {
    if (!txId || status.type !== "pending") return;

    pollStartTimeRef.current = Date.now();
    pollAttemptsRef.current = 0;
    pollErrorCountRef.current = 0;
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
      const result = await sendTransaction({
        recipient: form.recipient,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        merchant: form.merchant,
        destination: form.destination,
        note: form.note,
        reference: form.reference,
        metadata: paymentContext?.metadata || {}
      });

      const hasSuccessStatus = result?.status === "success";
      const hasTxHash = Boolean(result?.tx_hash);
      const isFailureStatus = result?.status === "failed";
      const isPendingStatus = result?.status === "pending";

      if (hasTxHash && (hasSuccessStatus || !isFailureStatus)) {
        const txIdFromResponse = result?.transaction?.id || result?.transaction_id;
        if (txIdFromResponse) {
          setTxId(txIdFromResponse);
        }

        setStatus({
          type: "success",
          message: "✨ Payment submitted successfully",
          txHash: result.tx_hash
        });
        setForm({ recipient: "", amount: "", currency: "XNO", merchant: "", destination: "", note: "", reference: "" });
        setScanError("");
        clearSavedPaymentContext();
        setPaymentContext(null);
        onClearContext?.();

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
        setStatus({
          type: "error",
          message: result?.error || "Payment failed. Please try again.",
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
    if (!text) return { recipient: "", amount: "" };

    let recipient = "";
    let amount = "";

    try {
      if (text.startsWith("nano:")) {
        const uri = new URL(text);
        recipient = uri.pathname.replace(/^\/+/, "");
        amount = uri.searchParams.get("amount") || "";
        if (recipient) return { recipient, amount };
      }
    } catch {}

    try {
      const jsonPayload = JSON.parse(text);
      if (jsonPayload && typeof jsonPayload === "object") {
        recipient = jsonPayload.recipient || jsonPayload.address || jsonPayload.wallet || jsonPayload.destination || "";
        amount = jsonPayload.amount != null ? String(jsonPayload.amount) : "";
        if (recipient) return { recipient, amount };
      }
    } catch {}

    try {
      if (text.includes("?")) {
        const [base, query] = text.split("?");
        const params = new URLSearchParams(query);
        recipient = params.get("address") || params.get("recipient") || params.get("wallet") || params.get("to") || base;
        amount = params.get("amount") || params.get("value") || "";
        if (recipient) return { recipient, amount };
      }
    } catch {}

    const walletMatch = text.match(/(nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59})/i);
    if (walletMatch) return { recipient: walletMatch[1], amount: "" };

    return { recipient: text, amount: "" };
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
          const { recipient, amount } = normalizeScannedText(decodedText);
          if (!recipient) {
            setScanError("Scanned QR is not a valid Nano address or payment payload.");
            return;
          }

          setForm((state) => ({ ...state, recipient, amount: amount || state.amount }));
          setStatus({ type: "success", message: "QR scanned and payment details auto-filled.", txHash: null });
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

  const handleClearPaymentContext = () => {
    setPaymentContext(null);
    clearSavedPaymentContext();
    onClearContext?.();
    setForm({ recipient: "", amount: "", currency: "XNO", merchant: "", destination: "", note: "", reference: "" });
    setStatus({ type: "idle", message: "", txHash: null });
  };

  return (
    <div className="stack-lg stitch-bg stitch-send-screen">
      <section className="card form-card glass-card send-surface stitch-send-card">
        <span className="eyebrow">Quick Transfer</span>
        <h1>Send Payment</h1>
        <p className="muted">Smart payment flow with QR-backed autofill, secure routing, and Fina assistant guidance.</p>

        {paymentContext && (
          <div className="payment-preview glass-card">
            <div className="preview-heading">Scanned Payment Preview</div>
            <div className="preview-row">
              <span>Merchant</span>
              <strong>{paymentContext.merchant || "Unknown merchant"}</strong>
            </div>
            <div className="preview-row">
              <span>Recipient</span>
              <strong>{paymentContext.recipient || paymentContext.destination || "Unknown"}</strong>
            </div>
            <div className="preview-row">
              <span>Amount</span>
              <strong>{paymentContext.amount || form.amount || "TBD"} {paymentContext.currency || form.currency}</strong>
            </div>
            {paymentContext.note && (
              <div className="preview-row">
                <span>Note</span>
                <strong>{paymentContext.note}</strong>
              </div>
            )}
            {paymentContext.reference && (
              <div className="preview-row">
                <span>Reference</span>
                <strong>{paymentContext.reference}</strong>
              </div>
            )}
            <div className="preview-row preview-raw">
              <span>Source</span>
              <strong>{paymentContext.source === "qr" ? "QR Scan" : "Manual"}</strong>
            </div>
            <button type="button" className="ghost-button" onClick={handleClearPaymentContext}>
              Clear scanned payment
            </button>
          </div>
        )}

        {smartWarnings.length > 0 && (
          <div className="status warning">
            <strong>⚠️ Smart Review</strong>
            <p>{smartWarnings.join(" ")}</p>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="payment-field-group">
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
              placeholder="Amount"
              value={form.amount}
              required
              disabled={loading}
            />
          </div>

          <div className="payment-field-group">
            <input
              name="currency"
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="Currency"
              value={form.currency}
              disabled={loading}
            />
            <input
              name="merchant"
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              placeholder="Merchant"
              value={form.merchant}
              disabled={loading}
            />
          </div>

          <input
            name="destination"
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder="Payment destination"
            value={form.destination}
            disabled={loading}
          />
          <input
            name="note"
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Note / description"
            value={form.note}
            disabled={loading}
          />
          <input
            name="reference"
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Reference"
            value={form.reference}
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
            <span className="muted">Use your camera to autofill and preserve payment context.</span>
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

          {scanError && (
            <div className="status error">
              <p>{scanError}</p>
              {permissionState === "denied" && (
                <div className="manual-fallback-actions">
                  <button type="button" className="ghost-button" onClick={openScanner}>
                    Try Camera Again
                  </button>
                  <button type="button" className="primary-button" onClick={() => { setScanError(""); setScanActive(false); }}>
                    Enter Address Manually
                  </button>
                </div>
              )}
            </div>
          )}

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
              <p className="muted">To continue, receive Nano to your wallet address first. This app does not sell Nano directly.</p>
            </div>
          )}

          {status.type === "pending" && (
            <div className="status pending">
              <strong>⏳ Processing Payment</strong>
              <p>{status.message}</p>
            </div>
          )}

          {status.type === "success" && (
            <div className="status success">
              <strong>✅ Payment Successful</strong>
              <p>{status.message}</p>
              {status.txHash && (
                <p className="tx-hash">
                  Hash: {status.txHash.slice(0, 16)}...
                  <button type="button" className="copy-button" onClick={() => navigator.clipboard.writeText(status.txHash)}>
                    Copy
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="trust-note">Powered by Nano network • Instant settlement</div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Payment"}
          </button>
        </form>
      </section>
    </div>
  );
}

