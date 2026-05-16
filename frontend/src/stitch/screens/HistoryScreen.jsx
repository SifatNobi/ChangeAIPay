import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TransactionItem from "../components/TransactionItem";
import { AIInsightCard, GoalProgress } from "../../components/RealtimeDashboard";
import { FINA_AI_IMAGE } from "../../constants/branding";
import "./HistoryScreen.css";

const GOALS_STORAGE_KEY = "changeaipay_goals";

function loadGoals() {
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function HistoryScreen({ token, loadHistory }) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [goals, setGoals] = useState(loadGoals);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: "", target: "" });

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    loadHistory({ limit: 100 })
      .then((data) => {
        setTransactions(data?.transactions || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load transaction history");
        setLoading(false);
      });
  }, [token, loadHistory]);

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

  const currentBalance = useMemo(() => {
    const totalReceived = transactions
      .filter(t => t.direction === "incoming")
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const totalSent = transactions
      .filter(t => t.direction === "outgoing")
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    return totalReceived - totalSent;
  }, [transactions]);

  const goalsWithProgress = useMemo(() => goals.map(goal => ({
    ...goal,
    current: Math.min(Math.max(currentBalance, 0), goal.target)
  })), [goals, currentBalance]);

  if (loading) {
    return (
      <div className="history-screen stitch-bg">
        <header className="history-header card glass-card">
          <h1>Transaction History</h1>
        </header>
        <div className="history-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-item card glass-card">
              <div className="skeleton-icon" />
              <div className="skeleton-main">
                <div className="skeleton-line skeleton-line--wide" />
                <div className="skeleton-line skeleton-line--narrow" />
              </div>
              <div className="skeleton-status" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-screen stitch-bg">
        <header className="history-header card glass-card">
          <h1>Transaction History</h1>
        </header>
        <div className="error-state card glass-card">
          <p>{error}</p>
          <button className="primary-button" onClick={() => navigate(0)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="history-screen stitch-bg">
      <header className="history-header card glass-card">
        <h1>Transaction History</h1>
      </header>

      <div className="history-ai-sections">
        <AIInsightCard transactions={transactions} finaImage={FINA_AI_IMAGE} onNavigate={navigate} />
        <div className="sidebar-section goals-section">
          <div className="goals-header">
            <h4>Your Goals</h4>
            <button className="set-goal-btn" onClick={handleOpenCreateGoal}>
              Set Goal
            </button>
          </div>
          <GoalProgress goals={goalsWithProgress} onEdit={handleOpenEditGoal} onDelete={handleDeleteGoal} />
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state card glass-card fade-in">
          <p>No transaction history yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {transactions.map((tx, i) => (
            <div key={tx?.id || i} className="fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
              <TransactionItem transaction={tx} />
            </div>
          ))}
        </div>
      )}

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
