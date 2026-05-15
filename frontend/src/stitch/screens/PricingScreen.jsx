import { useState, useEffect } from "react";
import { COMPANY_LOGO, COMPANY_NAME } from "../../constants/branding";
import { apiRequest } from "../../api";
import "./PricingScreen.css";

const PLANS = [
  {
    id: "free_trial",
    name: "Free Trial",
    price: 0,
    period: "one-time",
    description: "Basic AI finance chat, send/request money, fraud alerts",
    features: [
      { text: "Basic AI finance chat", included: true },
      { text: "Send & request money", included: true },
      { text: "Basic fraud alerts", included: true },
      { text: "Smart transcripts", included: true },
      { text: "Low balance alerts", included: true },
      { text: "Full AI Assistant", included: false },
      { text: "Smart routing", included: false },
      { text: "AI Financial Autopilot", included: false },
      { text: "AI Negotiator", included: false }
    ],
    limits: { fxFee: "1.45%", monthlyCap: "$400", fxFree: "$0" },
    cta: "Current Plan",
    popular: false
  },
  {
    id: "edge",
    name: "Edge",
    price: 19.99,
    period: "month",
    description: "Full AI assistant, fraud protection, smart routing",
    features: [
      { text: "Full AI Assistant", included: true },
      { text: "Fraud protection", included: true },
      { text: "Smart routing", included: true },
      { text: "Predictive reminders", included: true },
      { text: "Spending alerts", included: true },
      { text: "Spending coach", included: true },
      { text: "AI Financial Autopilot", included: false },
      { text: "Smart Social Payments Brain", included: false },
      { text: "AI Negotiator", included: false }
    ],
    limits: { fxFee: "0.95%", monthlyCap: "Unlimited", fxFree: "£800/mo" },
    cta: "Upgrade to Edge",
    popular: false
  },
  {
    id: "prime",
    name: "Prime",
    price: 29.99,
    period: "month",
    description: "AI Financial Autopilot, smart undo, social payments",
    features: [
      { text: "Full AI Assistant", included: true },
      { text: "AI Financial Autopilot", included: true },
      { text: "Smart Undo Payments", included: true },
      { text: "Smart Social Payments Brain", included: true },
      { text: "Advanced fraud detection", included: true },
      { text: "Dynamic budget optimization", included: true },
      { text: "Spending coach", included: true },
      { text: "Goal-based AI system", included: true },
      { text: "AI Negotiator", included: false }
    ],
    limits: { fxFee: "0.72%", monthlyCap: "Unlimited", fxFree: "£2,400/mo" },
    cta: "Upgrade to Prime",
    popular: true
  },
  {
    id: "apex",
    name: "Apex",
    price: 49.99,
    period: "month",
    description: "Autonomous AI payments, AI negotiator, life events",
    tagline: "Ultimate AI Automation",
    features: [
      { text: "Autonomous AI Payments", included: true },
      { text: "AI Negotiator", included: true },
      { text: "Life Event Mode", included: true },
      { text: "Priority smart routing", included: true },
      { text: "Booking + pay workflows", included: true },
      { text: "Everything in Prime", included: true },
      { text: "AI Financial Autopilot", included: true },
      { text: "Smart Social Payments Brain", included: true },
      { text: "Unlimited AI chats", included: true }
    ],
    limits: { fxFee: "0.58%", monthlyCap: "Unlimited", fxFree: "£4,800/mo" },
    cta: "Upgrade to Apex",
    popular: false,
    legendary: true,
    legendaryTitle: "Legendary Choice"
  }
];

export default function PricingScreen({ currentPlan = "free_trial", onSelectPlan, onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [clickedPlan, setClickedPlan] = useState(null);

  useEffect(() => {
    loadCurrentSubscription();
  }, []);

  const loadCurrentSubscription = async () => {
    try {
      const token = localStorage.getItem("changeaipay_token") || localStorage.getItem("token");
      if (token) {
        const data = await apiRequest("/subscription/current", { token });
        if (data?.subscription) {
          setCurrentSubscription(data.subscription);
        }
      }
    } catch (err) {
      console.log("No subscription found");
    }
  };

  const handleSelectPlan = async (planId) => {
    if (planId === currentPlan || planId === "free_trial") return;
    
    setClickedPlan(planId);
    setTimeout(() => setClickedPlan(null), 600);
    
    setLoading(true);
    try {
      const token = localStorage.getItem("changeaipay_token") || localStorage.getItem("token");
      const data = await apiRequest("/subscription/change", {
        method: "POST",
        token,
        body: { planId }
      });
      
      if (data?.success) {
        setCurrentSubscription({ ...currentSubscription, plan: planId });
        onSelectPlan?.(planId);
      }
    } catch (err) {
      console.error("Failed to change plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPlanState = (planId) => {
    if (planId === currentSubscription?.plan) return "current";
    if (PLANS.find(p => p.id === planId)?.price === 0) return "unavailable";
    return "upgrade";
  };

  return (
    <div className="pricing-page stitch-bg">
      <header className="pricing-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="pricing-logo" />
        <h1>Choose Your Plan</h1>
        <p>Unlock premium AI features and supercharge your payments</p>
      </header>

      <div className="pricing-grid">
        {PLANS.map((plan) => {
          const state = getPlanState(plan.id);
          
          return (
            <div 
              key={plan.id} 
              className={`pricing-card glass-card ${plan.popular ? "popular" : ""} ${plan.legendary ? "legendary" : ""} ${state} ${clickedPlan === plan.id ? "clicked" : ""}`}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              {plan.legendary && <div className="legendary-badge">{plan.legendaryTitle || "Legendary Choice"}</div>}
              
              <div className="plan-header">
                {plan.legendary && plan.tagline && (
                  <p className="legendary-tagline">{plan.tagline}</p>
                )}
                <h2>{plan.name}</h2>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.price}</span>
                  <span className="period">/{plan.period}</span>
                </div>
                <p className="plan-description">{plan.description}</p>
              </div>

              <div className="plan-limits">
                <div className="limit-item">
                  <span className="limit-label">FX Fee</span>
                  <span className="limit-value">{plan.limits.fxFee}</span>
                </div>
                <div className="limit-item">
                  <span className="limit-label">FX Free</span>
                  <span className="limit-value">{plan.limits.fxFree}</span>
                </div>
                <div className="limit-item">
                  <span className="limit-label">Monthly Cap</span>
                  <span className="limit-value">{plan.limits.monthlyCap}</span>
                </div>
              </div>

              <ul className="plan-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={feature.included ? "included" : "not-included"}>
                    <span className="feature-icon">
                      {feature.included ? "✓" : "×"}
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button 
                className={`plan-cta primary-button ${state}`}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={state === "current" || loading}
              >
                {state === "current" 
                  ? "Current Plan" 
                  : state === "unavailable" 
                    ? "Unavailable" 
                    : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pricing-footer">
        <p>All plans include instant, fee-less Nano transactions</p>
        <div className="pricing-trust">
          <span>🔒 Secure</span>
          <span>⚡ Instant</span>
          <span>🌍 Global</span>
        </div>
      </div>
    </div>
  );
}