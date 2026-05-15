import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TransactionItem from "../components/TransactionItem";
import "./HistoryScreen.css";

export default function HistoryScreen({ token, loadHistory }) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    </div>
  );
}
