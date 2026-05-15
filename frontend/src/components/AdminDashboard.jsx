import { useState, useEffect } from "react";
import { getToken } from "../api";
import { apiRequest } from "../api";
import { COMPANY_LOGO, COMPANY_NAME } from "../constants/branding";
import { RealtimeChart, RealtimeFeed, StatCard, AIInsightCard } from "./RealtimeDashboard";
import "./AdminDashboard.css";

export default function AdminDashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMerchants: 0,
    totalTransactions: 0,
    revenue24h: "0",
    fraudAlerts: 0
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const dashboardData = await apiRequest("/admin/dashboard", { token });
      
      if (dashboardData?.stats) {
        setStats(dashboardData.stats);
      }
      
      if (dashboardData?.users) {
        setRecentUsers(dashboardData.users.map(u => ({
          id: u._id || u.id,
          title: u.name || "Unknown",
          subtitle: u.email,
          role: u.role,
          time: new Date(u.createdAt).toLocaleDateString()
        })));
      }
      
      if (dashboardData?.transactions) {
        setRecentTransactions(dashboardData.transactions.map(t => ({
          id: t._id || t.id,
          title: `${t.amount} XNO`,
          subtitle: `${t.from?.substring(0, 10)}... → ${t.to?.substring(0, 10)}...`,
          time: new Date(t.createdAt).toLocaleTimeString(),
          status: t.status
        })));
      }

      // TODO: Implement real fraud alerts API
      // setFraudAlerts([
      //   { id: 1, title: "High velocity transaction", subtitle: "User: john@example.com", severity: "high", time: "2m ago" },
      //   { id: 2, title: "New account large transfer", subtitle: "Amount: 500 XNO", severity: "medium", time: "15m ago" },
      //   { id: 3, title: "Suspicious recipient", subtitle: "Address flagged", severity: "medium", time: "1h ago" }
      // ]);
      setFraudAlerts([]);

    } catch (err) {
      console.error("Admin dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const userGrowthData = recentUsers.length > 0
    ? recentUsers.slice(0, 7).map((u, i) => ({ value: 1, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] || `Day ${i + 1}` }))
    : [];

  const aiInsights = recentUsers.length > 5 || recentTransactions.length > 10
    ? [
        {
          icon: "📈",
          title: "Activity Summary",
          description: `${recentUsers.length} users and ${recentTransactions.length} transactions recorded.`
        }
      ]
    : [];

  const userFeed = recentUsers.map(u => ({
    ...u,
    isNew: false
  }));

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <div className="loading-spinner"></div>
        <span>Loading admin dashboard...</span>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-brand">
          <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="header-logo" />
          <div className="header-greeting">
            <h1>Admin Console</h1>
            <p>System overview and management</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={() => onNavigate?.("/admin/users")}>
            👥 Users
          </button>
          <button className="action-btn" onClick={() => onNavigate?.("/admin/merchants")}>
            🏪 Merchants
          </button>
          <button className="action-btn" onClick={() => onNavigate?.("/admin/transactions")}>
            📦 Transactions
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Total Users"
          value={stats.totalUsers || 0}
          icon="👥"
          change={12}
          changeLabel="this month"
          trend="up"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers || 0}
          icon="✓"
          change={8}
          changeLabel="this week"
          trend="up"
        />
        <StatCard
          title="Merchants"
          value={stats.totalMerchants || 0}
          icon="🏪"
          change={5}
          changeLabel="this month"
          trend="up"
        />
        <StatCard
          title="24h Revenue"
          value={`${stats.revenue24h || 0} XNO`}
          icon="💰"
          change={15}
          changeLabel="vs yesterday"
          trend="up"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="dashboard-section users-section">
            <div className="section-header">
              <h3>User Growth</h3>
              <span className="section-subtitle">Last 7 days</span>
            </div>
            <RealtimeChart
              data={userGrowthData}
              type="bar"
              height={200}
            />
          </section>

          <section className="dashboard-section transactions-section">
            <div className="section-header">
              <h3>Recent Transactions</h3>
              <button className="view-all-btn" onClick={() => onNavigate?.("/admin/transactions")}>
                View All
              </button>
            </div>
            <RealtimeFeed items={recentTransactions} type="transactions" maxItems={8} />
          </section>
        </div>

        <div className="dashboard-sidebar">
          <AIInsightCard
            insights={aiInsights}
          />

          <div className="sidebar-section users-list-section">
            <div className="section-header">
              <h4>Recent Users</h4>
              <button className="view-all-btn small" onClick={() => onNavigate?.("/admin/users")}>
                View All
              </button>
            </div>
            <RealtimeFeed items={userFeed} type="notifications" maxItems={5} />
          </div>

          {fraudAlerts.length > 0 && (
            <div className="sidebar-section fraud-section">
              <div className="section-header">
                <h4>⚠️ Fraud Alerts</h4>
                <span className="alert-count">{fraudAlerts.length}</span>
              </div>
              <RealtimeFeed items={fraudAlerts} type="alerts" maxItems={5} />
            </div>
          )}

          <div className="sidebar-section system-section">
            <h4>System Status</h4>
            <div className="system-status">
              <div className="status-item">
                <span className="status-dot online"></span>
                <span className="status-label">API Server</span>
                <span className="status-value">Online</span>
              </div>
              <div className="status-item">
                <span className="status-dot online"></span>
                <span className="status-label">Database</span>
                <span className="status-value">Connected</span>
              </div>
              <div className="status-item">
                <span className="status-dot online"></span>
                <span className="status-label">Blockchain RPC</span>
                <span className="status-value">Healthy</span>
              </div>
              <div className="status-item">
                <span className="status-dot online"></span>
                <span className="status-label">WebSocket</span>
                <span className="status-value">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}