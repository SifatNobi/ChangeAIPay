import { useState, useEffect } from "react";
import { COMPANY_LOGO, COMPANY_NAME, FINA_AI_IMAGE } from "../../constants/branding";
import { apiRequest } from "../../api";
import "./MerchantPricingScreen.css";

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
    price: "2.20% cap",
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

export default function MerchantPricingScreen({ currentTier = "startup", onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const token = localStorage.getItem("changeaipay_token") || localStorage.getItem("token");
      if (token) {
        const data = await apiRequest("/merchant-subscription/current", { token });
        if (data?.subscription) {
          setSubscription(data.subscription);
        }
      }
    } catch (err) {
      console.log("No merchant subscription");
    }
  };

  const handleContactSales = (planId) => {
    alert("Contact our sales team for Enterprise plans: sales@changeaipay.com");
  };

  const getPlanState = (planId) => {
    if (planId === subscription?.tier) return "current";
    return "upgrade";
  };

  return (
    <div className="merchant-pricing-page stitch-bg">
      <header className="merchant-pricing-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="pricing-logo" />
        <h1>Merchant Plans</h1>
        <p>Scale your business with AI-powered tools</p>
      </header>

      <div className="merchant-pricing-fina">
        <img src={FINA_AI_IMAGE} alt="Fina" className="fina-avatar" />
        <p>Fina AI helps merchants maximize revenue!</p>
      </div>

      <div className="merchant-plans-grid">
        {MERCHANT_PLANS.map((plan) => {
          const state = getPlanState(plan.id);
          
          return (
            <div 
              key={plan.id} 
              className={`merchant-plan-card glass-card ${plan.popular ? "popular" : ""} ${state}`}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              
              <div className="plan-header">
                <h2>{plan.name}</h2>
                <div className="revenue-badge">{plan.revenue}</div>
              </div>

              <div className="pricing-row">
                <div className="price-box">
                  <span className="price-label">Platform Fee</span>
                  <span className="price-value">{plan.price}</span>
                </div>
                <div className="price-box">
                  <span className="price-label">FX Spread</span>
                  <span className="price-value">{plan.fx}</span>
                </div>
              </div>

              <p className="plan-desc">{plan.description}</p>

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
                onClick={() => plan.id === "enterprise" || plan.id === "retention" 
                  ? handleContactSales(plan.id) 
                  : null}
                disabled={state === "current"}
              >
                {plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div className="merchant-pricing-footer">
        <div className="feature-legend">
          <span className="legend-item">
            <span className="legend-icon">✓</span>
            Included
          </span>
          <span className="legend-item">
            <span className="legend-icon">×</span>
            Not included
          </span>
        </div>
        <p>All plans include instant payment processing and 24/7 support</p>
      </div>
    </div>
  );
}