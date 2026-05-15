import React, { useState, useEffect } from "react";

export default function UserDashboard({ profile, token, loadHistory }) {
  const [transactions, setTransactions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (token) {
      loadHistory({ limit: 10 })
        .then(data => {
          setTransactions(data?.transactions || []);
          setRecentActivity(data?.transactions?.slice(0, 5) || []);
        })
        .catch(() => setTransactions([]));
    }
  }, [token, loadHistory]);

  const balance = profile?.balance?.balanceNano || "0";
  const walletAddress = profile?.walletAddress || profile?.user?.walletAddress || "";

  const quickActions = [
    { label: "Send", icon: "↑", path: "/send" },
    { label: "Receive", icon: "↓", path: "/dashboard" },
    { label: "History", icon: "≡", path: "/dashboard" },
    { label: "Swap", icon: "⇄", path: "/dashboard" }
  ];

  return (
    <div className="user-dashboard stitch-bg">
      <header className="user-header card glass-card">
        <div className="user-greeting">
          <span className="eyebrow">Welcome back</span>
          <h1>{profile?.user?.name || "User"}</h1>
        </div>
      </header>

      <section className="user-balance card glass-card neon-sheen">
        <span className="eyebrow">Total Balance</span>
        <strong className="balance-amount">{balance} XNO</strong>
        <div className="balance-actions">
          <button className="primary-button action-pill">Add Funds</button>
          <button className="ghost-button action-pill">Withdraw</button>
        </div>
      </section>

      <section className="quick-actions-grid">
        {quickActions.map(action => (
          <button key={action.label} className="quick-action-btn card glass-card">
            <span className="quick-icon">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </section>

      <section className="card glass-card">
        <div className="section-heading">
          <span className="eyebrow">Recent Activity</span>
          <h2>Transactions</h2>
        </div>
        <div className="activity-list">
          {recentActivity.length === 0 ? (
            <div className="empty-state">No recent activity</div>
          ) : (
            recentActivity.map((tx, i) => (
              <div key={tx?.id || i} className="activity-item">
                <div className={`activity-icon ${tx.direction}`}>
                  {tx.direction === "incoming" ? "↓" : "↑"}
                </div>
                <div className="activity-info">
                  <span className="activity-amount">
                    {tx.direction === "incoming" ? "+" : "-"}{tx.amount} XNO
                  </span>
                  <span className="activity-time">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`activity-status ${tx.status}`}>{tx.status}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card glass-card">
        <div className="section-heading">
          <span className="eyebrow">Your Wallet</span>
          <h2>Wallet Address</h2>
        </div>
        <div className="wallet-display">
          <code className="wallet-address mono">{walletAddress || "Loading..."}</code>
          <button className="ghost-button copy-btn">Copy</button>
        </div>
      </section>
    </div>
  );
}