import { useState, useEffect } from "react";
import { getToken } from "../api";
import { getMerchantSubscription, getMerchantAnalytics, getCashFlowPrediction, getLifetimeValueData } from "../api";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME } from "../constants/branding";
import { RealtimeChart, RealtimeFeed, StatCard, AIInsightCard } from "./RealtimeDashboard";
import "./MerchantDashboard.css";

export default function MerchantDashboard({ profile, token, loadHistory, onNavigate }) {
  const [stats, setStats] = useState({
    revenue: "0",
    transactions: 0,
    avgTransaction: "0",
    customers: 0
  });
  const [subscription, setSubscription] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [cashflow, setCashflow] = useState({ predictions: [] });
  const [ltvData, setLtvData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [token]);

  const loadDashboardData = async () => {
    try {
      const authToken = token || getToken();
      if (!authToken) return;

      const [subData, analyticsData, cashflowData, ltv] = await Promise.all([
        getMerchantSubscription(authToken),
        getMerchantAnalytics(authToken).catch(() => ({})),
        getCashFlowPrediction(authToken).catch(() => ({ predictions: [] })),
        getLifetimeValueData(authToken).catch(() => null)
      ]);

      if (subData?.subscription) {
        setSubscription(subData.subscription);
        setStats({
          revenue: analyticsData?.analytics?.monthlyRevenue || "0",
          transactions: analyticsData?.analytics?.transactionCount || 0,
          avgTransaction: ((analyticsData?.analytics?.monthlyRevenue || 0) / (analyticsData?.analytics?.transactionCount || 1)).toFixed(2),
          customers: analyticsData?.analytics?.customerCount || 0
        });
      }

      if (analyticsData?.analytics) {
        setAnalytics(analyticsData.analytics);
      }

      if (cashflowData?.predictions) {
        setCashflow(cashflowData);
      }

      if (ltv?.data) {
        setLtvData(ltv.data);
      }

    } catch (err) {
      console.error("Merchant dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const revenueData = cashflow.predictions.map((p, i) => ({
    value: p.projectedRevenue,
    label: `M${i + 1}`
  }));

  const customerFeed = [];

  const aiInsights = subscription?.features && stats.transactions > 0 ? [
    subscription.features.aiRevenueBooster && {
      icon: "📈",
      title: "Revenue Opportunity",
      description: "Based on recent trends, analyze your revenue patterns."
    },
    subscription.features.customerLifetimeValue && {
      icon: "👥",
      title: "Customer Insights",
      description: "Customer lifetime value data will appear after more activity."
    },
    subscription.features.smartPricingEngine && {
      icon: "💡",
      title: "Pricing Insights",
      description: "Pricing suggestions will appear after analyzing transaction data."
    }
  ].filter(Boolean) : [];

  const alertItems = (analytics?.alerts || []).map(alert => ({
    id: alert._id || Date.now(),
    title: alert.message || alert.type,
    subtitle: alert.severity,
    severity: alert.severity,
    time: new Date(alert.createdAt).toLocaleTimeString()
  }));

  const hasData = stats.transactions > 0 || analytics?.transactionCount > 0;
  const hasSubscription = subscription?.tier;

  if (loading) {
    return (
      <div className="merchant-dashboard-loading">
        <div className="loading-spinner"></div>
        <span>Loading merchant dashboard...</span>
      </div>
    );
  }

  if (!hasSubscription) {
    return (
      <div className="merchant-dashboard-empty">
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h2>Get Started with Merchant Services</h2>
          <p>Choose a merchant plan to start accepting payments and unlock business analytics.</p>
          <button className="empty-state-btn" onClick={() => onNavigate?.("/merchant-pricing")}>
            View Merchant Plans
          </button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="merchant-dashboard-empty">
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 011.5 0zm0 0v.75M3.75 4.5a.75.75 0 011.5 0v-.75a.75.75 0 01-1.5 0zm0 13.5v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 011.5 0zm13.5-13.5v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 011.5 0zm0 13.5v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 011.5 0z" />
            </svg>
          </div>
          <h2>No Transactions Yet</h2>
          <p>Your merchant dashboard will display real analytics once you start processing payments.</p>
          <button className="empty-state-btn" onClick={() => onNavigate?.("/qr")}>
            Create Payment QR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="merchant-dashboard">
      <div className="dashboard-header">
        <div className="header-brand">
          <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="header-logo" />
          <div className="header-greeting">
            <span className="merchant-badge">{subscription?.tier || "Startup"} Tier</span>
            <h1>{profile?.user?.name || "Your Business"}</h1>
            <p>Business performance overview</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={() => onNavigate?.("/analytics")}>
            📊 Analytics
          </button>
          <button className="action-btn primary" onClick={() => onNavigate?.("/customers")}>
            👥 Customers
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Monthly Revenue"
          value={`${parseFloat(stats.revenue || 0).toFixed(2)} XNO`}
          icon="💰"
          change={8.5}
          changeLabel="vs last month"
          trend="up"
        />
        <StatCard
          title="Transactions"
          value={stats.transactions || 0}
          icon="📦"
          change={12.3}
          changeLabel="vs last month"
          trend="up"
        />
        <StatCard
          title="Avg Transaction"
          value={`${stats.avgTransaction || 0} XNO`}
          icon="📊"
          change={-2.1}
          changeLabel="vs last month"
          trend="down"
        />
        <StatCard
          title="Total Customers"
          value={stats.customers || 0}
          icon="👥"
          change={5.7}
          changeLabel="vs last month"
          trend="up"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="dashboard-section revenue-section">
            <div className="section-header">
              <h3>Revenue Forecast</h3>
              <span className="section-subtitle">Next 6 months projection</span>
            </div>
            <RealtimeChart
              data={revenueData}
              type="bar"
              height={240}
            />
          </section>

          <section className="dashboard-section customers-section">
            <div className="section-header">
              <h3>Recent Customers</h3>
              <button className="view-all-btn" onClick={() => onNavigate?.("/customers")}>
                View All
              </button>
            </div>
            <RealtimeFeed items={customerFeed} type="notifications" maxItems={5} />
          </section>
        </div>

        <div className="dashboard-sidebar">
          <AIInsightCard
            insights={aiInsights}
            finaImage={FINA_AI_IMAGE}
          />

          {subscription?.features?.strongerCashFlowPredictor && (
            <div className="sidebar-section cashflow-section">
              <h4>Cash Flow Forecast</h4>
              <div className="cashflow-summary">
                <div className="cf-item">
                  <span className="cf-label">This Month</span>
                  <span className="cf-value positive">{stats.revenue} XNO</span>
                </div>
                <div className="cf-item">
                  <span className="cf-label">Next Month</span>
                  <span className="cf-value">{cashflow.predictions[0]?.projectedRevenue || "—"} XNO</span>
                </div>
                <div className="cf-item">
                  <span className="cf-label">Confidence</span>
                  <span className="cf-value">{((cashflow.predictions[0]?.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {subscription?.features?.customerLifetimeValue && ltvData && (
            <div className="sidebar-section ltv-section">
              <h4>Customer Lifetime Value</h4>
              <div className="ltv-summary">
                <div className="ltv-main">
                  <span className="ltv-value">{ltvData.averageLTV}</span>
                  <span className="ltv-label">Avg LTV</span>
                </div>
                <div className="ltv-segments">
                  {ltvData.segments?.map((seg, i) => (
                    <div key={i} className="segment-item">
                      <span className="segment-name">{seg.name}</span>
                      <span className="segment-count">{seg.count} customers</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {alertItems.length > 0 && (
            <div className="sidebar-section alerts-section">
              <h4>⚠️ Business Alerts</h4>
              <RealtimeFeed items={alertItems} type="alerts" maxItems={4} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}