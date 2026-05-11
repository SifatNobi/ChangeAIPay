import { useState, useEffect } from "react";
import { FINA_IMAGE } from "../../components/AIAssistant";

export default function MerchantDashboard({ profile, token, loadHistory }) {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    todayRevenue: "0",
    monthRevenue: "0",
    avgTransaction: "0",
    successRate: "100%"
  });

  useEffect(() => {
    if (token) {
      loadHistory({ limit: 20 })
        .then(data => {
          const txs = data?.transactions || [];
          setTransactions(txs);
          calculateStats(txs);
        })
        .catch(() => setTransactions([]));
    }
  }, [token, loadHistory]);

  const calculateStats = (txs) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTxs = txs.filter(tx => new Date(tx.createdAt) >= today);
    const todaySum = todayTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    const monthTxs = txs.filter(tx => {
      const txDate = new Date(tx.createdAt);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return txDate >= monthAgo;
    });
    const monthSum = monthTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    const avg = txs.length > 0 ? monthSum / txs.length : 0;
    const successTxs = txs.filter(tx => tx.status === "confirmed").length;
    const successRate = txs.length > 0 ? (successTxs / txs.length) * 100 : 100;

    setStats({
      todayRevenue: todaySum.toFixed(2),
      monthRevenue: monthSum.toFixed(2),
      avgTransaction: avg.toFixed(2),
      successRate: `${successRate.toFixed(1)}%`
    });
  };

  return (
    <div className="merchant-dashboard stitch-bg">
      <header className="merchant-header card glass-card">
        <div>
          <span className="eyebrow">Merchant HQ</span>
          <h1 className="merchant-name">{profile?.user?.name || "Your Business"}</h1>
          <div className="wallet-chip">
            <span>wallet</span>
            <span className="mono">{profile?.walletAddress || "Loading..."}</span>
          </div>
        </div>
        <div className="pill confirmed">Network: Live</div>
      </header>

      <section className="merchant-stats">
        <div className="stat-card card glass-card neon-sheen">
          <span className="eyebrow">Today's Revenue</span>
          <strong className="stat-value">{stats.todayRevenue} XNO</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="eyebrow">Monthly Revenue</span>
          <strong className="stat-value">{stats.monthRevenue} XNO</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="eyebrow">Avg Transaction</span>
          <strong className="stat-value">{stats.avgTransaction} XNO</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="eyebrow">Success Rate</span>
          <strong className="stat-value">{stats.successRate}</strong>
        </div>
      </section>

      <section className="card glass-card">
        <div className="section-heading">
          <span className="eyebrow">Payment Analytics</span>
          <h2>Transaction Overview</h2>
        </div>
        <div className="merchant-chart">
          <div className="chart-placeholder">
            <img src={FINA_IMAGE} alt="Fina AI Analytics" className="chart-ai-assistant" />
            <p>AI-powered analytics coming soon</p>
          </div>
        </div>
      </section>

      <section className="card glass-card">
        <div className="section-heading">
          <span className="eyebrow">Recent Payments</span>
          <h2>Transactions</h2>
        </div>
        <div className="transaction-list">
          {transactions.length === 0 ? (
            <div className="empty-state">No transactions yet</div>
          ) : (
            transactions.map((tx, i) => (
              <div key={tx?.id || tx?.hash || i} className="transaction-row">
                <div className="tx-direction">
                  {tx.direction === "incoming" ? "↓" : "↑"}
                </div>
                <div className="tx-details">
                  <span className="tx-amount">{tx.amount} XNO</span>
                  <span className="tx-address mono">
                    {tx.direction === "incoming" 
                      ? `From: ${tx.fromAddress?.substring(0, 12)}...`
                      : `To: ${tx.toAddress?.substring(0, 12)}...`
                    }
                  </span>
                </div>
                <div className={`tx-status ${tx.status}`}>
                  {tx.status}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}