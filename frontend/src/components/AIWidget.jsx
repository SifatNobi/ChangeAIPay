import { FINA_IMAGE } from "./AIAssistant";

export function AINotification({ notification, onDismiss }) {
  return (
    <div className="ai-notification">
      <img src={FINA_IMAGE} alt="Fina" className="ai-notif-avatar" />
      <div className="ai-notif-content">
        <span className="ai-notif-title">Fina AI</span>
        <p>{notification.message}</p>
      </div>
      <button onClick={onDismiss} className="ai-notif-dismiss">×</button>
    </div>
  );
}

export function AIDashboardWidget({ user, stats }) {
  return (
    <div className="ai-widget card glass-card">
      <div className="ai-widget-header">
        <img src={FINA_IMAGE} alt="Fina" className="ai-widget-avatar" />
        <span>AI Insights</span>
      </div>
      <div className="ai-widget-body">
        <p>Welcome back, {user?.name || "User"}!</p>
        <div className="ai-widget-stats">
          <div className="ai-stat">
            <span className="ai-stat-value">{stats?.transactions || 0}</span>
            <span className="ai-stat-label">Transactions</span>
          </div>
          <div className="ai-stat">
            <span className="ai-stat-value">{stats?.balance || "0"}</span>
            <span className="ai-stat-label">XNO Balance</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIOnboarding({ step, onComplete }) {
  const steps = [
    {
      title: "Welcome to ChangeAIPay",
      content: "Your instant, fee-less cryptocurrency payment platform.",
      icon: FINA_IMAGE
    },
    {
      title: "Send & Receive",
      content: "Send Nano instantly to anyone, anywhere with zero fees.",
      icon: FINA_IMAGE
    },
    {
      title: "Secure Wallet",
      content: "Your keys, your crypto. Fully secure and under your control.",
      icon: FINA_IMAGE
    }
  ];

  return (
    <div className="ai-onboarding">
      <img src={steps[step]?.icon || FINA_IMAGE} alt="Fina" className="ai-onboard-avatar" />
      <h3>{steps[step]?.title}</h3>
      <p>{steps[step]?.content}</p>
      <button className="primary-button" onClick={onComplete}>
        {step < steps.length - 1 ? "Next" : "Get Started"}
      </button>
    </div>
  );
}