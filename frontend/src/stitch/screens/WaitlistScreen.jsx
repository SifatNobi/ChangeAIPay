import { useState } from "react";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME, COMPANY_TAGLINE } from "../../constants/branding";
import { joinWaitlist } from "../../api";
import "./WaitlistScreen.css";

export default function WaitlistScreen() {
  const [form, setForm] = useState({ email: "", phone: "" });
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!email || !emailRegex.test(email)) {
      setStatus({ loading: false, error: "Please enter a valid email address", success: false });
      return;
    }

    setStatus({ loading: true, error: "", success: false });

    try {
      await joinWaitlist({ email, phone });
      setStatus({ loading: false, error: "", success: true });
    } catch (err) {
      setStatus({ 
        loading: false, 
        error: err?.message || "Something went wrong. Please try again.", 
        success: false 
      });
    }
  };

  if (status.success) {
    return (
      <div className="waitlist-success">
        <div className="success-avatar">
          <img src={FINA_AI_IMAGE} alt="Fina" />
        </div>
        <h2>You're on the list!</h2>
        <p>We'll notify you when ChangeAIPay is ready.</p>
        <div className="success-badge">
          <span>✓</span> Position secured
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist-container">
      <div className="waitlist-brand">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="waitlist-logo" />
        <span className="waitlist-tagline">{COMPANY_TAGLINE}</span>
      </div>

      <div className="waitlist-card">
        <div className="waitlist-logo-wrapper">
          <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="waitlist-brand-logo" />
        </div>

        <h1>Join the Future of Payments</h1>
        <p className="waitlist-description">
          Be among the first to experience instant, fee-less cryptocurrency transactions.
        </p>

        <form onSubmit={handleSubmit} className="waitlist-form">
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <input
              type="tel"
              name="phone"
              placeholder="Phone number (optional)"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
            />
          </div>

          {status.error && <p className="error-message">{status.error}</p>}

          <button 
            type="submit" 
            className="primary-button waitlist-button"
            disabled={status.loading}
          >
            {status.loading ? "Joining..." : "Join Waitlist"}
          </button>
        </form>

        <p className="waitlist-note">
          Join 10,000+ early adopters. No spam, ever.
        </p>
      </div>

      <div className="waitlist-features">
        <div className="feature">
          <span className="feature-icon">⚡</span>
          <span>Instant</span>
        </div>
        <div className="feature">
          <span className="feature-icon">💰</span>
          <span>Zero Fees</span>
        </div>
        <div className="feature">
          <span className="feature-icon">🔒</span>
          <span>Secure</span>
        </div>
      </div>
    </div>
  );
}