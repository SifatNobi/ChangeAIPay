import { useEffect, useRef, useState } from "react";

export default function SendScreen({ sendTransaction }) {
  const [form, setForm] = useState({ recipient: "", amount: "" });
  const [status, setStatus] = useState({ type: "idle", message: "", txHash: null });
  const [loading, setLoading] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "pending", message: "Processing payment...", txHash: null });

    try {
      const result = await sendTransaction(form);
      const txHash = result?.transaction?.txHash || result?.tx_hash || null;
      const hasHash = Boolean(txHash);
      const isPending = result?.status === "pending" || result?.state === "processing";

      if (hasHash || result?.success || result?.status === "success") {
        setStatus({
          type: "success",
          message: `Payment successful! ${result?.message || "Transaction submitted."}`,
          txHash
        });
        setForm({ recipient: "", amount: "" });
        setScanError("");
      } else if (isPending) {
        setStatus({
          type: "pending",
          message: result?.message || "Payment processing... Check back in a moment.",
          txHash
        });
      } else {
        const errorMsg = result?.error || "Payment failed";
        const statusDetail = result?.status ? ` (${result.status})` : "";
        setStatus({
          type: "error",
          message: `${errorMsg}${statusDetail}`,
          txHash: null
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Payment failed. Please try again.",
        txHash: null
      });
    } finally {
      setLoading(false);
    }
  }

  async function openScanner() {
    if (scanActive || scannerRef.current) return;
    setScanError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("qr-scanner");
      scannerRef.current = html5QrCode;
      setScanActive(true);

      await html5QrCode.start(
        { facingMode: { exact: "environment" } },
        { fps: 10, qrbox: 250, disableFlip: true },
        (decodedText) => {
          setForm((state) => ({ ...state, recipient: decodedText }));
          setStatus({ type: "success", message: "QR scanned. Recipient autofilled.", txHash: null });
          stopScanner();
        },
        () => {}
      );
    } catch (err) {
      setScanError("Unable to access camera. Please enter the recipient manually.");
      setScanActive(false);
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
            <div className="qr-scanner-container">
              <div id="qr-scanner" />
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

