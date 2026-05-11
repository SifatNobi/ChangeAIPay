import { useState, useEffect } from "react";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME } from "../constants/branding";
import { apiRequest, getToken } from "../api";
import "./PricingCheckout.css";

const PLAN_PRICING = {
  edge: { name: "Edge", price: 24.99, fxFee: "0.95%", fxFree: "€1,000" },
  prime: { name: "Prime", price: 39.99, fxFee: "0.72%", fxFree: "€3,000" },
  apex: { name: "Apex", price: 64.99, fxFee: "0.58%", fxFree: "€6,000" }
};

export default function PricingCheckout({ selectedPlan, onComplete, onCancel }) {
  const [currency, setCurrency] = useState("EUR");
  const [conversion, setConversion] = useState(null);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("fiat");
  const [userBalance, setUserBalance] = useState(0);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    loadPricingData();
  }, [selectedPlan, currency]);

  const loadPricingData = async () => {
    try {
      const token = getToken();
      
      const [plansRes, methodsRes] = await Promise.all([
        apiRequest(`/billing/plans?currency=${currency}`, { token }),
        apiRequest("/billing/methods", { token }).catch(() => null)
      ]);

      if (plansRes?.plans) {
        const plan = plansRes.plans.find(p => p.id === selectedPlan);
        if (plan) {
          setConversion(plan);
        }
        setRates(plansRes.rates);
      }

      if (methodsRes?.paymentMethods) {
        const nanoMethod = methodsRes.paymentMethods.find(m => m.id === "xno");
        if (nanoMethod) {
          setUserBalance(nanoMethod.balance || 0);
        }
      }

      if (plansRes?.plans && token) {
        const checkoutData = await apiRequest("/billing/checkout", {
          method: "POST",
          token,
          body: { planId: selectedPlan, currency }
        });
        
        if (checkoutData?.recommendations) {
          setRecommendation(checkoutData.recommendations);
        }
      }
    } catch (err) {
      console.error("Pricing load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const token = getToken();
      
      const result = await apiRequest("/billing/process", {
        method: "POST",
        token,
        body: { 
          sessionId: `checkout_${selectedPlan}`, 
          paymentMethod,
          paymentData: {}
        }
      });

      if (result?.success) {
        onComplete?.(result);
      } else {
        alert(result?.error || "Payment failed");
      }
    } catch (err) {
      alert("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const plan = PLAN_PRICING[selectedPlan];
  const canPayWithNano = userBalance >= (conversion?.nanoPrice || 0);
  const nanoSavings = conversion && (plan.price * 0.029).toFixed(2);

  if (loading) {
    return (
      <div className="checkout-loading">
        <div className="loading-spinner"></div>
        <span>Loading pricing...</span>
      </div>
    );
  }

  return (
    <div className="pricing-checkout">
      <div className="checkout-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="checkout-logo" />
        <h2>Complete Your Subscription</h2>
        <p>Choose your preferred payment method</p>
      </div>

      <div className="plan-summary">
        <div className="plan-badge">{plan?.name} Plan</div>
        <div className="plan-price">
          <span className="fiat-price">€{plan?.price}</span>
          {conversion?.nanoPrice > 0 && (
            <span className="nano-price">
              ≈ {conversion.nanoPrice.toFixed(4)} XNO
            </span>
          )}
        </div>
        <span className="billing-period">per month</span>
      </div>

      {recommendation?.suggestNano && (
        <div className="nano-recommendation">
          <div className="recommendation-icon">⚡</div>
          <div className="recommendation-text">
            <strong>Save €{nanoSavings} in processing fees!</strong>
            <p>Pay with Nano to avoid card fees. You have {userBalance.toFixed(2)} XNO in your wallet.</p>
          </div>
        </div>
      )}

      <div className="payment-methods">
        <h3>Payment Method</h3>

        <label className={`payment-option ${paymentMethod === "xno" ? "selected" : ""} ${canPayWithNano ? "nano-available" : "nano-disabled"}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="xno"
            checked={paymentMethod === "xno"}
            onChange={() => setPaymentMethod("xno")}
            disabled={!canPayWithNano}
          />
          <span className="method-icon">⚡</span>
          <div className="method-details">
            <span className="method-name">Pay with Nano (XNO)</span>
            <span className="method-fees">0% fees • Instant settlement</span>
            {canPayWithNano && <span className="nano-balance">Balance: {userBalance.toFixed(2)} XNO</span>}
            {!canPayWithNano && <span className="nano-warning">Insufficient balance</span>}
          </div>
          <span className="method-savings">Save {nanoSavings}€</span>
        </label>

        <label className={`payment-option ${paymentMethod === "fiat" ? "selected" : ""}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="fiat"
            checked={paymentMethod === "fiat"}
            onChange={() => setPaymentMethod("fiat")}
          />
          <span className="method-icon">💳</span>
          <div className="method-details">
            <span className="method-name">Credit/Debit Card</span>
            <span className="method-fees">2.9% + €0.25 processing fees</span>
          </div>
        </label>

        <label className="payment-option coming-soon">
          <input type="radio" disabled />
          <span className="method-icon">🏦</span>
          <div className="method-details">
            <span className="method-name">Bank Transfer</span>
            <span className="method-fees">Coming soon</span>
          </div>
        </label>
      </div>

      {paymentMethod === "xno" && canPayWithNano && (
        <div className="xno-summary">
          <div className="summary-row">
            <span>Subscription ({plan?.name})</span>
            <span>€{plan?.price}</span>
          </div>
          <div className="summary-row">
            <span>Processing fees</span>
            <span className="fee-saved">€0.00</span>
          </div>
          <div className="summary-row total">
            <span>Total (via Nano)</span>
            <span>€{plan?.price}</span>
          </div>
          <div className="summary-row">
            <span>You'll pay</span>
            <span className="nano-amount">{conversion?.nanoPrice.toFixed(4)} XNO</span>
          </div>
        </div>
      )}

      {paymentMethod === "fiat" && (
        <div className="fiat-summary">
          <div className="summary-row">
            <span>Subscription ({plan?.name})</span>
            <span>€{plan?.price}</span>
          </div>
          <div className="summary-row">
            <span>Processing fees</span>
            <span>€{(plan?.price * 0.029 + 0.25).toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>€{(plan?.price * 1.029 + 0.25).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="checkout-actions">
        <button className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
        <button 
          className="primary-button"
          onClick={handlePayment}
          disabled={processing || (paymentMethod === "xno" && !canPayWithNano)}
        >
          {processing ? "Processing..." : paymentMethod === "xno" ? "Pay with Nano" : "Pay with Card"}
        </button>
      </div>

      <div className="checkout-fina">
        <img src={FINA_AI_IMAGE} alt="Fina" className="fina-avatar" />
        <p>Need help? Ask Fina for payment assistance.</p>
      </div>
    </div>
  );
}