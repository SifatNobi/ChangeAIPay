import React, { useState, useEffect } from "react";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME } from "../../constants/branding";
import { apiRequest } from "../../api";
import "./PricingScreen.css";

const CONSUMER_PLANS = [
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

const MERCHANT_PLANS = [
  {
    id: "startup",
    name: "Startup",
    revenue: "Up to $10K/year",
    price: "1.25%",
    fx: "1.00%",
    description: "AI Revenue Booster, Basic Cash Flow Predictor",
    features: [
      { text: "AI Revenue Booster", included: true },
      { text: "Basic Cash Flow Predictor", included: true },
      { text: "Smart transcripts", included: true },
      { text: "Money monitoring", included: true },
      { text: "Entry analytics dashboard", included: true },
      { text: "Auto-Personalized Marketing", included: false },
      { text: "AI Upsell Assistant", included: false },
      { text: "Pricing suggestions", included: false },
      { text: "Smart Pricing Engine", included: false },
      { text: "Customer Lifetime Value", included: false },
      { text: "AI Customer Recovery", included: false },
      { text: "Enterprise features", included: false }
    ],
    cta: "Current Plan",
    popular: false
  },
  {
    id: "growth",
    name: "Growth",
    revenue: "$10K–$50K/year",
    price: "1.75%",
    fx: "0.85%",
    description: "Auto-Personalized Marketing, AI Upsell Assistant",
    features: [
      { text: "Everything in Startup", included: true },
      { text: "Auto-Personalized Marketing", included: true },
      { text: "AI Upsell Assistant", included: true },
      { text: "Pricing suggestions", included: true },
      { text: "Customer re-engagement tools", included: true },
      { text: "Smart Pricing Engine", included: false },
      { text: "Customer Lifetime Value", included: false },
      { text: "Business Health Dashboard", included: false },
      { text: "AI Customer Recovery", included: false },
      { text: "Enterprise features", included: false }
    ],
    cta: "Upgrade to Growth",
    popular: false
  },
  {
    id: "scale",
    name: "Scale",
    revenue: "$50K–$100K/year",
    price: "2.25%",
    fx: "0.70%",
    description: "Smart Pricing Engine, Customer Lifetime Value",
    features: [
      { text: "Everything in Growth", included: true },
      { text: "Smart Pricing Engine", included: true },
      { text: "Customer Lifetime Value Predictor", included: true },
      { text: "Full Business Health Dashboard", included: true },
      { text: "Stronger Cash Flow Predictor", included: true },
      { text: "AI Customer Recovery", included: false },
      { text: "Dynamic demand pricing", included: false },
      { text: "Enterprise features", included: false }
    ],
    cta: "Upgrade to Scale",
    popular: true
  },
  {
    id: "premium",
    name: "Premium",
    revenue: "$100K+/year",
    price: "2.75% capped",
    fx: "0.60%",
    description: "AI Customer Recovery, Dynamic demand pricing",
    features: [
      { text: "Everything in Scale", included: true },
      { text: "AI Customer Recovery System", included: true },
      { text: "Dynamic demand pricing", included: true },
      { text: "Advanced churn prevention", included: true },
      { text: "Priority support", included: true },
      { text: "Premium analytics", included: true },
      { text: "Enterprise features", included: false }
    ],
    cta: "Upgrade to Premium",
    popular: false
  },
  {
    id: "retention",
    name: "Retention",
    revenue: "$400K+/year",
    price: "2.35%",
    fx: "0.50%",
    description: "Retention-focused AI campaigns, Profitability optimization",
    features: [
      { text: "Everything in Premium", included: true },
      { text: "Retention-focused AI campaigns", included: true },
      { text: "Profitability optimization models", included: true },
      { text: "Lower FX pricing", included: true },
      { text: "Enterprise features", included: false }
    ],
    cta: "Contact Sales",
    popular: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    revenue: "$500K+/year",
    price: "2.20% enterprise cap",
    fx: "0.45%",
    description: "AI call handling, Custom workflows, API customization",
    features: [
      { text: "Everything in Retention", included: true },
      { text: "AI call handling and messaging", included: true },
      { text: "Custom AI workflow automation", included: true },
      { text: "Enterprise infrastructure licensing", included: true },
      { text: "Dedicated fraud intelligence models", included: true },
      { text: "API customization", included: true },
      { text: "Private routing logic", included: true },
      { text: "Strategic account management", included: true }
    ],
    cta: "Contact Sales",
    popular: false
  }
];

export default function PricingScreen({ currentPlan = "free_trial", onSelectPlan, onNavigate, userRole = "user" }) {
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [clickedPlan, setClickedPlan] = useState(null);
  const [activeTab, setActiveTab] = useState(userRole === "merchant" ? "merchants" : "consumers");

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
    if (activeTab === "consumers" && CONSUMER_PLANS.find(p => p.id === planId)?.price === 0) return "unavailable";
    return "upgrade";
  };

  const displayPlans = activeTab === "consumers" ? CONSUMER_PLANS : MERCHANT_PLANS;

  const handleMerchantPlanAction = (planId) => {
    if (planId === "enterprise" || planId === "retention") {
      setClickedPlan(planId);
      setTimeout(() => setClickedPlan(null), 600);
      alert("Contact our sales team for this plan: sales@changeaipay.com");
      return;
    }
    handleSelectPlan(planId);
  };

  return (
    <div className="pricing-page stitch-bg">
      <header className="pricing-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="pricing-logo" />
        <h1>Choose Your Plan</h1>
        <p>Unlock premium AI features and supercharge your payments</p>
      </header>

      <div className="pricing-tabs">
        <button
          className={`pricing-tab ${activeTab === "consumers" ? "active" : ""}`}
          onClick={() => setActiveTab("consumers")}
        >
          Consumers
        </button>
        <button
          className={`pricing-tab ${activeTab === "merchants" ? "active" : ""}`}
          onClick={() => setActiveTab("merchants")}
        >
          Merchants
        </button>
      </div>

      <div className="pricing-fina">
        <img src={FINA_AI_IMAGE} alt="Fina" className="fina-avatar" />
        <p>{activeTab === "consumers" ? "Upgrade your experience with Fina AI!" : "Fina AI helps merchants maximize revenue!"}</p>
      </div>

      <div className="pricing-grid">
        {displayPlans.map((plan) => {
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
                {plan.revenue && (
                  <div className="revenue-badge">{plan.revenue}</div>
                )}
                <h2>{plan.name}</h2>
                {activeTab === "merchants" ? (
                  <div className="merchant-pricing-row">
                    <div className="merchant-price-box">
                      <span className="merchant-price-label">Platform Fee</span>
                      <span className="merchant-price-value">{plan.price}</span>
                    </div>
                    <div className="merchant-price-box">
                      <span className="merchant-price-label">FX Spread</span>
                      <span className="merchant-price-value">{plan.fx}</span>
                    </div>
                  </div>
                ) : (
                  <div className="plan-price">
                    <span className="currency">$</span>
                    <span className="amount">{plan.price}</span>
                    <span className="period">/{plan.period}</span>
                  </div>
                )}
                <p className="plan-description">{plan.description}</p>
              </div>

              {activeTab === "consumers" && (
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
              )}

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
                onClick={() => activeTab === "merchants" ? handleMerchantPlanAction(plan.id) : handleSelectPlan(plan.id)}
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
        <p>{activeTab === "consumers" ? "All plans include instant, fee-less Nano transactions" : "All plans include instant payment processing and 24/7 support"}</p>
        <div className="pricing-trust">
          <span>🔒 Secure</span>
          <span>⚡ Instant</span>
          <span>🌍 Global</span>
        </div>
      </div>
    </div>
  );
}