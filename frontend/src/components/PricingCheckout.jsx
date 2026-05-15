import React, { useState, useEffect } from "react";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME } from "../constants/branding";
import { apiRequest, getToken } from "../api";
import "./PricingCheckout.css";

const PLAN_PRICING = {
  edge: { name: "Edge", price: 19.99, fxFee: "0.95%", fxFree: "£800" },
  prime: { name: "Prime", price: 29.99, fxFee: "0.72%", fxFree: "£2,400" },
  apex: { name: "Apex", price: 49.99, fxFee: "0.58%", fxFree: "£4,800" }
};

function validateCardNumber(num) {
  const cleaned = num.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let n = parseInt(cleaned[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateExpiry(val) {
  const match = val.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const now = new Date();
  const year = parseInt("20" + match[2], 10);
  const month = parseInt(match[1], 10);
  if (year < now.getFullYear()) return false;
  if (year === now.getFullYear() && month < now.getMonth() + 1) return false;
  return true;
}

function validateCVC(val) {
  return /^\d{3,4}$/.test(val);
}

function formatCardNumber(val) {
  const cleaned = val.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
}

function formatExpiry(val) {
  const cleaned = val.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
  }
  return cleaned;
}

function detectCardType(num) {
  const cleaned = num.replace(/\s/g, "");
  if (/^4/.test(cleaned)) return "visa";
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return "mastercard";
  if (/^3[47]/.test(cleaned)) return "amex";
  if (/^6(?:011|5)/.test(cleaned)) return "discover";
  return "unknown";
}

export default function PricingCheckout({ selectedPlan, onComplete, onCancel }) {
  const [currency, setCurrency] = useState("EUR");
  const [conversion, setConversion] = useState(null);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("fiat");
  const [userBalance, setUserBalance] = useState(0);
  const [recommendation, setRecommendation] = useState(null);

  const [paymentStatus, setPaymentStatus] = useState("idle");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardErrors, setCardErrors] = useState({});
  const [cardTouched, setCardTouched] = useState({});

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

  const validateCardFields = () => {
    const errors = {};
    if (!validateCardNumber(cardNumber)) {
      errors.cardNumber = "Enter a valid card number";
    }
    if (!validateExpiry(cardExpiry)) {
      errors.cardExpiry = "Enter a valid expiry date (MM/YY)";
    }
    if (!validateCVC(cardCVC)) {
      errors.cardCVC = "Enter a valid CVC";
    }
    if (!cardName.trim()) {
      errors.cardName = "Enter the cardholder name";
    }
    setCardErrors(errors);
    setCardTouched({ cardNumber: true, cardExpiry: true, cardCVC: true, cardName: true });
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async () => {
    setProcessing(true);
    setPaymentStatus("pending");
    try {
      const token = getToken();
      
      if (paymentMethod === "fiat") {
        if (!validateCardFields()) {
          setProcessing(false);
          setPaymentStatus("failed");
          return;
        }

        const cardType = detectCardType(cardNumber);
        const result = await apiRequest("/billing/checkout", {
          method: "POST",
          token,
          body: { 
            planId: selectedPlan,
            currency,
            paymentMethod: "fiat",
            cardDetails: {
              last4: cardNumber.replace(/\s/g, "").slice(-4),
              cardType,
              expiry: cardExpiry,
              cardholderName: cardName.trim()
            }
          }
        });

        if (result?.success === true && result.session?.url) {
          window.location.href = result.session.url;
          return;
        } else if (result?.success === true) {
          setPaymentStatus("success");
          onComplete?.(result);
          return;
        } else {
          setPaymentStatus("failed");
          alert(result?.error || "Failed to create checkout session");
        }
      } else {
        const result = await apiRequest("/billing/process", {
          method: "POST",
          token,
          body: { 
            sessionId: `checkout_${selectedPlan}`, 
            paymentMethod,
            paymentData: {}
          }
        });

        if (result?.success === true) {
          setPaymentStatus("success");
          onComplete?.(result);
        } else {
          setPaymentStatus("failed");
          alert(result?.error || "Payment failed");
        }
      }
    } catch (err) {
      setPaymentStatus("failed");
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setPaymentStatus("idle");
    setProcessing(false);
    setLoading(true);
    setPaymentMethod("fiat");
    setConversion(null);
    setRecommendation(null);
    setUserBalance(0);
    setCardNumber("");
    setCardExpiry("");
    setCardCVC("");
    setCardName("");
    setCardErrors({});
    setCardTouched({});
    onCancel?.();
  };

  const plan = PLAN_PRICING[selectedPlan];
  const canPayWithNano = userBalance >= (conversion?.nanoPrice || 0);
  const nanoInsufficient = paymentMethod === "xno" && !canPayWithNano;
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

        <label className={`payment-option ${paymentMethod === "xno" ? "selected" : ""} ${!canPayWithNano ? "nano-insufficient" : "nano-available"}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="xno"
            checked={paymentMethod === "xno"}
            onChange={() => setPaymentMethod("xno")}
          />
          <span className="method-icon">⚡</span>
          <div className="method-details">
            <span className="method-name">Pay with Nano (XNO)</span>
            <span className="method-fees">0% fees • Instant settlement</span>
            <span className="nano-balance">Balance: {userBalance.toFixed(2)} XNO</span>
            {!canPayWithNano && <span className="nano-warning">Insufficient balance — add funds or choose another method</span>}
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

      {paymentMethod === "xno" && (
        <div className="xno-summary">
          {nanoInsufficient && (
            <div className="nano-insufficient-banner">
              <span className="banner-icon">⚠️</span>
              <div className="banner-text">
                <strong>Insufficient Nano Balance</strong>
                <p>Your balance ({userBalance.toFixed(2)} XNO) is not enough for this plan ({conversion?.nanoPrice.toFixed(4)} XNO). You can still proceed — the system will attempt the payment and notify you if it fails, or you can switch to card payment.</p>
              </div>
            </div>
          )}
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
        <>
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

          <div className="card-input-section">
            <h3>Card Details</h3>
            <div className="card-input-grid">
              <div className="input-group full-width">
                <label htmlFor="cardNumber">Card Number</label>
                <div className="input-wrapper">
                  <input
                    id="cardNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    onBlur={() => setCardTouched(prev => ({ ...prev, cardNumber: true }))}
                    className={cardTouched.cardNumber && cardErrors.cardNumber ? "input-error" : ""}
                    autoComplete="cc-number"
                    maxLength={19}
                  />
                  <span className={`card-type-icon card-${detectCardType(cardNumber)}`}></span>
                </div>
                {cardTouched.cardNumber && cardErrors.cardNumber && (
                  <span className="field-error">{cardErrors.cardNumber}</span>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="cardExpiry">Expiry Date</label>
                <input
                  id="cardExpiry"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  onBlur={() => setCardTouched(prev => ({ ...prev, cardExpiry: true }))}
                  className={cardTouched.cardExpiry && cardErrors.cardExpiry ? "input-error" : ""}
                  autoComplete="cc-exp"
                  maxLength={5}
                />
                {cardTouched.cardExpiry && cardErrors.cardExpiry && (
                  <span className="field-error">{cardErrors.cardExpiry}</span>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="cardCVC">CVC</label>
                <input
                  id="cardCVC"
                  type="password"
                  inputMode="numeric"
                  placeholder="•••"
                  value={cardCVC}
                  onChange={(e) => setCardCVC(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => setCardTouched(prev => ({ ...prev, cardCVC: true }))}
                  className={cardTouched.cardCVC && cardErrors.cardCVC ? "input-error" : ""}
                  autoComplete="cc-csc"
                  maxLength={4}
                />
                {cardTouched.cardCVC && cardErrors.cardCVC && (
                  <span className="field-error">{cardErrors.cardCVC}</span>
                )}
              </div>

              <div className="input-group full-width">
                <label htmlFor="cardName">Cardholder Name</label>
                <input
                  id="cardName"
                  type="text"
                  placeholder="Name on card"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  onBlur={() => setCardTouched(prev => ({ ...prev, cardName: true }))}
                  className={cardTouched.cardName && cardErrors.cardName ? "input-error" : ""}
                  autoComplete="cc-name"
                />
                {cardTouched.cardName && cardErrors.cardName && (
                  <span className="field-error">{cardErrors.cardName}</span>
                )}
              </div>
            </div>
            <p className="secure-notice">
              🔒 Your card data is processed securely. We never store raw card details.
            </p>
          </div>
        </>
      )}

      <div className="checkout-actions">
        <button className="ghost-button" onClick={handleCancel}>
          Cancel
        </button>
        <button 
          className="primary-button"
          onClick={handlePayment}
          disabled={processing}
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
