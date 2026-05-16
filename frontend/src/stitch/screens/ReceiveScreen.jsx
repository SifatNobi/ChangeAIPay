import React, { useState, useEffect, useMemo, useCallback } from "react";
import QRCode from "qrcode";
import { COMPANY_LOGO, COMPANY_NAME, FINA_AI_IMAGE } from "../../constants/branding";
import { AIInsightCard, GoalProgress } from "../../components/RealtimeDashboard";
import "./ReceiveScreen.css";

const GOALS_STORAGE_KEY = "changeaipay_goals";

function loadGoals() {
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function ReceiveScreen({ profile, onNavigate }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [goals, setGoals] = useState(loadGoals);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: "", target: "" });

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

  useEffect(() => {
    try {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
    } catch (e) {
      console.error("Failed to save goals:", e);
    }
  }, [goals]);

  useEffect(() => {
    const handleOpenGoals = () => {
      setEditingGoal(null);
      setGoalForm({ name: "", target: "" });
      setShowGoalModal(true);
    };
    window.addEventListener("open-goals", handleOpenGoals);
    return () => window.removeEventListener("open-goals", handleOpenGoals);
  }, []);

  const handleOpenCreateGoal = useCallback(() => {
    setEditingGoal(null);
    setGoalForm({ name: "", target: "" });
    setShowGoalModal(true);
  }, []);

  const handleOpenEditGoal = useCallback((goal) => {
    setEditingGoal(goal);
    setGoalForm({ name: goal.name, target: goal.target.toString() });
    setShowGoalModal(true);
  }, []);

  const handleDeleteGoal = useCallback((goalId) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
  }, []);

  const handleSaveGoal = useCallback((e) => {
    e.preventDefault();
    const name = goalForm.name.trim();
    const target = parseFloat(goalForm.target);
    if (!name || isNaN(target) || target <= 0) return;

    if (editingGoal) {
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, name, target } : g));
    } else {
      const newGoal = { id: Date.now().toString(), name, target, createdAt: new Date().toISOString() };
      setGoals(prev => [...prev, newGoal]);
    }
    setShowGoalModal(false);
    setEditingGoal(null);
    setGoalForm({ name: "", target: "" });
  }, [goalForm.name, goalForm.target, editingGoal]);

  return (
    <div className="receive-screen">
      <div className="receive-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="receive-logo" />
        <h1>Receive Payments</h1>
        <p>Enter an amount and share your QR code</p>
      </div>

      <div className="receive-ai-sections">
        <AIInsightCard transactions={[]} finaImage={FINA_AI_IMAGE} onNavigate={onNavigate} />
        <div className="sidebar-section goals-section">
          <div className="goals-header">
            <h4>Your Goals</h4>
            <button className="set-goal-btn" onClick={handleOpenCreateGoal}>
              Set Goal
            </button>
          </div>
          <GoalProgress goals={goals} onEdit={handleOpenEditGoal} onDelete={handleDeleteGoal} />
        </div>
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

      {showGoalModal && (
        <div className="goal-modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="goal-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGoal ? "Edit Goal" : "Set New Goal"}</h3>
              <button className="modal-close" onClick={() => setShowGoalModal(false)}>×</button>
            </div>
            <form className="goal-form" onSubmit={handleSaveGoal}>
              <div className="form-group">
                <label htmlFor="goal-name">Goal Name</label>
                <input
                  id="goal-name"
                  type="text"
                  placeholder="e.g., New Laptop, Vacation"
                  value={goalForm.name}
                  onChange={e => setGoalForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="goal-target">Target Amount (XNO)</label>
                <input
                  id="goal-target"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="0.0000"
                  value={goalForm.target}
                  onChange={e => setGoalForm(prev => ({ ...prev, target: e.target.value }))}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowGoalModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingGoal ? "Update Goal" : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
