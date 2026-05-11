import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import "./QRSystem.css";

const NANO_ADDRESS_REGEX = /^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/i;
const SCAN_COOLDOWN = 2000;

export function useQRScanner({ onScan, onError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const scannerRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  const validateNanoAddress = useCallback((text) => {
    const cleaned = text.trim().replace(/^nano:/i, "").split("?")[0];
    
    if (NANO_ADDRESS_REGEX.test(cleaned)) {
      return { valid: true, address: cleaned, type: "nano_address" };
    }

    const uriMatch = text.match(/nano:([13][13456789abcdefghijkmnopqrstuwxyz]{59})/i);
    if (uriMatch) {
      return { valid: true, address: uriMatch[1], type: "nano_uri" };
    }

    try {
      const url = new URL(text);
      if (url.protocol === "nano:" && url.pathname) {
        return { valid: true, address: url.pathname.replace("/", ""), type: "nano_protocol" };
      }
    } catch {}

    try {
      const params = new URLSearchParams(text.split("?")[1]);
      const nanoParam = params.get("nano") || params.get("address") || params.get("to");
      if (nanoParam && NANO_ADDRESS_REGEX.test(nanoParam)) {
        return { valid: true, address: nanoParam, type: "url_param" };
      }
    } catch {}

    return { valid: false, address: null, type: null };
  }, []);

  const handleScanSuccess = useCallback((decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < SCAN_COOLDOWN) {
      return;
    }
    lastScanTimeRef.current = now;

    const validation = validateNanoAddress(decodedText);
    
    if (validation.valid) {
      setLastScanned({
        address: validation.address,
        timestamp: new Date().toISOString(),
        rawValue: decodedText
      });
      onScan?.({
        address: validation.address,
        type: validation.type,
        rawValue: decodedText
      });
    } else {
      onError?.({
        message: "Invalid QR code. Not a valid Nano address.",
        rawValue: decodedText
      });
    }
  }, [validateNanoAddress, onScan, onError]);

  const startScanning = useCallback(async (elementId) => {
    if (scannerRef.current) return;

    try {
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          torch: false
        },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true
        },
        handleScanSuccess,
        (error) => {
          console.log("QR scan frame:", error);
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setHasPermission(false);
        onError?.({ message: "Camera permission denied", error: err });
      } else if (err.name === "NotFoundError") {
        onError?.({ message: "No camera found", error: err });
      } else {
        onError?.({ message: err.message, error: err });
      }
    }
  }, [handleScanSuccess, onError]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.log("Scanner cleanup error:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
        if (capabilities.torchFeature().isSupported()) {
          const currentState = await capabilities.torchFeature().value();
          await capabilities.torchFeature().apply(!currentState);
        }
      } catch (err) {
        console.log("Torch error:", err);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return {
    isScanning,
    hasPermission,
    lastScanned,
    startScanning,
    stopScanning,
    toggleTorch,
    validateNanoAddress
  };
}

export function QRPaymentScanner({ onPaymentReady, onCancel }) {
  const [mode, setMode] = useState("receive");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [scannedData, setScannedData] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const { startScanning, stopScanning, validateNanoAddress, hasPermission } = useQRScanner({
    onScan: (data) => {
      setScannedData(data);
      setRecipient(data.address);
      setIsScanning(false);
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const handleStartScan = async () => {
    setError(null);
    setIsScanning(true);
    await startScanning("qr-reader-container");
  };

  const handleStopScan = async () => {
    await stopScanning();
    setIsScanning(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validation = validateNanoAddress(recipient);
    if (!validation.valid) {
      setError("Invalid Nano address");
      return;
    }

    onPaymentReady?.({
      recipient: validation.address,
      amount: parseFloat(amount) || 0,
      note,
      scannedFromQR: !!scannedData
    });
  };

  return (
    <div className="qr-payment-scanner">
      <div className="qr-mode-tabs">
        <button 
          className={mode === "receive" ? "active" : ""}
          onClick={() => setMode("receive")}
        >
          Receive
        </button>
        <button 
          className={mode === "send" ? "active" : ""}
          onClick={() => setMode("send")}
        >
          Send
        </button>
      </div>

      {mode === "send" && (
        <>
          {!isScanning ? (
            <button className="primary-button scan-btn" onClick={handleStartScan}>
              📷 Scan QR Code
            </button>
          ) : (
            <div className="scanner-view">
              <div id="qr-reader-container" className="qr-reader"></div>
              <button className="ghost-button" onClick={handleStopScan}>
                Cancel
              </button>
            </div>
          )}

          {error && <div className="qr-error">{error}</div>}

          {hasPermission === false && (
            <div className="qr-permission-error">
              <p>Camera access denied</p>
              <button className="ghost-button" onClick={handleStartScan}>
                Try Again
              </button>
              <button 
                className="ghost-button"
                onClick={() => setMode("manual")}
              >
                Enter Manually
              </button>
            </div>
          )}

          {(scannedData || recipient) && (
            <div className="scanned-info">
              <div className="address-preview">
                {scannedData?.address || recipient}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="payment-form">
            <input
              type="text"
              placeholder="Nano Address"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setScannedData(null);
              }}
              className="address-input"
            />
            <input
              type="number"
              placeholder="Amount (XNO)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.000001"
              min="0"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button 
              type="submit" 
              className="primary-button"
              disabled={!recipient || !amount}
            >
              Send {amount || "0"} XNO
            </button>
          </form>
        </>
      )}

      {mode === "receive" && (
        <div className="receive-mode">
          <p>Show this QR code to receive payments</p>
          <div className="receive-placeholder">
            Your wallet QR will appear here
          </div>
        </div>
      )}
    </div>
  );
}

export default useQRScanner;