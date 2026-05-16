import React, { useState, useEffect, useMemo, useCallback } from "react";
import QRCode from "qrcode";
import { COMPANY_LOGO, COMPANY_NAME } from "../../constants/branding";
import "./ReceiveScreen.css";

export default function ReceiveScreen({ profile, onNavigate }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const walletAddress = useMemo(() => {
    return (
      profile?.walletAddress ||
      profile?.user?.walletAddress ||
      profile?.balance?.walletAddress ||
      ""
    );
  }, [profile]);

  const sessionId = useMemo(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  const receiveUri = useMemo(() => {
    if (!walletAddress) return "";
    let uri = `nano:${walletAddress}`;
    const params = [];
    if (amount) params.push(`amount=${amount}`);
    if (note) params.push(`note=${encodeURIComponent(note)}`);
    params.push(`timestamp=${Date.now()}`);
    params.push(`session=${sessionId}`);
    if (params.length > 0) uri += "?" + params.join("&");
    return uri;
  }, [walletAddress, amount, note, sessionId]);

  useEffect(() => {
    if (!receiveUri) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(receiveUri, { margin: 1, width: 320, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [receiveUri]);

  const handleCopyAddress = useCallback(() => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [walletAddress]);

  const handleDownloadQR = useCallback(() => {
    if (qrDataUrl) {
      setDownloading(true);
      const link = document.createElement("a");
      link.download = `changeaipay-qr-${Date.now()}.png`;
      link.href = qrDataUrl;
      link.click();
      setTimeout(() => setDownloading(false), 500);
    }
  }, [qrDataUrl]);

  return (
    <div className="receive-screen">
      <div className="receive-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="receive-logo" />
        <h1>Receive Payments</h1>
        <p>Enter an amount and share your QR code</p>
      </div>

      <div className="receive-card">
        <div className="receive-form">
          <div className="form-group">
            <label htmlFor="receive-amount">Amount (XNO)</label>
            <input
              id="receive-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.000001"
            />
          </div>
          <div className="form-group">
            <label htmlFor="receive-note">Note (optional)</label>
            <input
              id="receive-note"
              type="text"
              placeholder="Payment note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        <div className="qr-section">
          {qrDataUrl ? (
            <div className="qr-display">
              <img src={qrDataUrl} alt="Payment QR Code" className="qr-image" />
              {amount && <div className="qr-amount-badge">{amount} XNO</div>}
            </div>
          ) : (
            <div className="qr-empty">
              <div className="qr-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="3" height="3" />
                  <line x1="21" y1="14" x2="21" y2="14.01" strokeWidth="3" strokeLinecap="round" />
                  <line x1="14" y1="21" x2="14.01" y2="21" strokeWidth="3" strokeLinecap="round" />
                  <line x1="18" y1="21" x2="18.01" y2="21" strokeWidth="3" strokeLinecap="round" />
                  <line x1="21" y1="18" x2="21.01" y2="18" strokeWidth="3" strokeLinecap="round" />
                  <line x1="21" y1="21" x2="21.01" y2="21" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <p>Enter an amount to generate QR</p>
            </div>
          )}
        </div>

        {walletAddress && (
          <div className="wallet-section">
            <label>Wallet Address</label>
            <div className="wallet-address-row">
              <code className="wallet-address">{walletAddress}</code>
              <button className="copy-btn" onClick={handleCopyAddress}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="receive-actions">
          <button className="ghost-button" onClick={() => onNavigate?.("/dashboard")}>
            Back to Dashboard
          </button>
          {qrDataUrl && (
            <button className="primary-button" onClick={handleDownloadQR} disabled={downloading}>
              {downloading ? "Downloading..." : "Download QR"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
