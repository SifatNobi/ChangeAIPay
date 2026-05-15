import { useState, useEffect } from "react";
import { getToken } from "../api";
import { getPaymentHistory, getCurrentSubscription, getSubscriptionUsage } from "../api";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME } from "../constants/branding";
import { RealtimeChart, RealtimeFeed, StatCard, AIInsightCard, GoalProgress, SubscriptionStatus } from "./RealtimeDashboard";
import "./UserDashboard.css";

export default function UserDashboard({ profile, token, onNavigate }) {
  const [stats, setStats] = useState({
    balance: "0",
    totalReceived: "0",
    totalSent: "0",
    transactionCount: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [token]);

  const loadDashboardData = async () => {
    try {
      const authToken = token || getToken();
      if (!authToken) return;

      const [historyData, subData, usageData] = await Promise.all([
        getPaymentHistory(authToken, { limit: 20 }),
        getCurrentSubscription(authToken),
        getSubscriptionUsage(authToken).catch(() => ({}))
      ]);

      if (historyData?.transactions) {
        setTransactions(historyData.transactions);
        
        const summary = historyData.summary || {};
        setStats({
          balance: profile?.balance?.balanceNano || "0",
          totalReceived: summary.received || "0",
          totalSent: summary.sent || "0",
          totalTransactions: historyData.total || 0
        });
      }

      if (subData?.subscription) {
        setSubscription(subData.subscription);
      }

      if (usageData?.usage) {
        setUsage(usageData.usage);
      }

      const newNotifications = [];
      if (transactions.length === 0) {
        newNotifications.push({ id: 1, type: "info", title: "Welcome to ChangeAIPay!", message: "Start sending and receiving crypto instantly." });
      }
      setNotifications(newNotifications);

    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const balanceChartData = transactions.slice(0, 7).reverse().map((t, i) => ({
    value: parseFloat(t.amount || 0),
    label: new Date(t.createdAt).toLocaleDateString("en", { weekday: "short" })
  }));

  const transactionFeed = transactions.slice(0, 8).map(t => ({
    id: t._id || t.hash,
    title: t.direction === "incoming" ? `Received ${t.amount} XNO` : `Sent ${t.amount} XNO`,
    subtitle: t.toAddress?.substring(0, 12) + "..." || t.fromAddress?.substring(0, 12) + "...",
    direction: t.direction,
    time: getRelativeTime(t.createdAt),
    isNew: false
  }));

  const aiInsights = transactions.length > 5 ? [
    {
      icon: "📊",
      title: "Activity Summary",
      description: `You've made ${transactions.length} transactions recently.`
    }
  ] : [];

  const goals = [];

  if (loading) {
    return (
      <div className="user-dashboard-loading">
        <div className="loading-spinner"></div>
        <span>Loading your dashboard...</span>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <div className="header-brand">
          <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="header-logo" />
          <div className="header-greeting">
            <h1>Welcome back, {profile?.user?.name || "User"}</h1>
            <p>Here's your financial overview</p>
          </div>
        </div>
        <div className="header-fina">
          <img src={FINA_AI_IMAGE} alt="Fina" className="fina-avatar" />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Balance"
          value={`${parseFloat(stats.balance || 0).toFixed(4)} XNO`}
          icon="💰"
        />
        <StatCard
          title="Received"
          value={`${parseFloat(stats.totalReceived || 0).toFixed(4)} XNO`}
          icon="↓"
        />
        <StatCard
          title="Sent"
          value={`${parseFloat(stats.totalSent || 0).toFixed(4)} XNO`}
          icon="↑"
        />
        <StatCard
          title="Transactions"
          value={stats.totalTransactions || 0}
          icon="📊"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="dashboard-section balance-section">
            <RealtimeChart
              title="Balance History"
              subtitle="Last 7 days"
              data={balanceChartData}
              type="line"
              height={220}
            />
          </section>

          <section className="dashboard-section activity-section">
            <div className="section-header">
              <h3>Recent Activity</h3>
              <button className="view-all-btn" onClick={() => onNavigate?.("/history")}>
                View All
              </button>
            </div>
            <RealtimeFeed 
              items={transactionFeed} 
              type="transactions" 
              maxItems={6}
            />
          </section>
        </div>

        <div className="dashboard-sidebar">
          <AIInsightCard 
            insights={aiInsights}
            finaImage={FINA_AI_IMAGE}
          />

          <div className="sidebar-section subscription-section">
            <SubscriptionStatus 
              plan={subscription?.plan || "free_trial"}
              usage={usage}
              onUpgrade={() => onNavigate?.("/pricing")}
            />
          </div>

          <div className="sidebar-section goals-section">
            <h4>Your Goals</h4>
            <GoalProgress goals={goals} />
          </div>
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="dashboard-notifications">
          {notifications.map(notif => (
            <div key={notif.id} className={`dashboard-notif ${notif.type}`}>
              <span>{notif.title}</span>
              <button onClick={() => setNotifications(n => n.filter(x => x.id !== notif.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getRelativeTime(date) {
  if (!date) return "just now";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}