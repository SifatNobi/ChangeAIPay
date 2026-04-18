import { useState } from "react";
import { Link } from "react-router-dom";
import { joinWaitlist } from "../../api";
import BrandMark from "../components/BrandMark";

export default function LoginScreen({
  mode,
  onSubmit,
  loading,
  error
}) {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState({ type: "idle", message: "" });
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    onSubmit({
      name: String(payload.name || ""),
      email: String(payload.email || ""),
      password: String(payload.password || "")
    });
  }

  async function handleJoinWaitlist(e) {
    e.preventDefault();
    setWaitlistStatus({ type: "idle", message: "" });
    const email = String(waitlistEmail || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistStatus({ type: "error", message: "Please enter a valid email." });
      return;
    }

    setWaitlistLoading(true);
    try {
      const result = await joinWaitlist(email);
      setWaitlistStatus({ type: "success", message: result.message || "You're on the list" });
      setWaitlistEmail("");
    } catch (err) {
      setWaitlistStatus({ type: "error", message: err?.message || "Unable to join the waitlist." });
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <div className="auth-shell stitch-bg stitch-login-screen">
      <div className="stitch-orb orb-a" />
      <div className="stitch-orb orb-b" />
      <header className="auth-topbar">
        <div className="brand-lockup">
          <BrandMark size={44} />
          <h1 className="brand-title">ChangeAIPay</h1>
        </div>
      </header>
      <div className="auth-panel stitch-login-layout">
        <div className="hero-copy stitch-login-hero">
          <div className="hero-badge stitch-pill">
            <span className="bolt">⚡</span>
            <span>The Future of Value</span>
          </div>
          <h1>
            Zero-fee instant payments
            <span className="hero-highlight"> with Nano</span>
          </h1>
          <p className="muted">
            Experience the world&apos;s most efficient digital currency protocol.
          </p>
        </div>

        <div className="card auth-card glass-card auth-surface login-surface stitch-login-card">
          <div className="brand-lockup auth-brand">
            <BrandMark size={40} />
            <strong>ChangeAIPay</strong>
          </div>
          <h2>{mode === "login" ? "Login" : "Register"}</h2>

          <form className="form-stack" onSubmit={submit}>
            {mode === "register" && (
              <input name="name" placeholder="Name" required />
            )}
            <input name="email" placeholder="Email" required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={8}
            />

            {error && <div className="status error">{error}</div>}

            <button className="primary-button auth-cta" disabled={loading} type="submit">
              {loading ? "Loading..." : mode}
            </button>
          </form>

          <p className="switch-copy">
            <Link className="ghost-link" to={mode === "login" ? "/register" : "/login"}>
              {mode === "login"
                ? "Need an account? Register"
                : "Already have an account? Login"}
            </Link>
          </p>
        </div>
      </div>
      <section className="card glass-card auth-about-card">
        <span className="eyebrow">Instant, zero-fee payments using Nano</span>
        <h2>Save fees and settle instantly</h2>
        <p className="muted">
          Merchants can save up to 2–5% per transaction. Consumers avoid hidden fees. Savings may vary based on usage.
        </p>
        <div className="compare-grid">
          <div>
            <strong>Traditional payments</strong>
            <p>2–5% fees</p>
          </div>
          <div>
            <strong>Our system</strong>
            <p>0% fees</p>
          </div>
        </div>
      </section>
      <section className="card glass-card auth-waitlist-card">
        <span className="eyebrow">Join the waitlist</span>
        <p className="muted">Submit your email to reserve early access and product updates.</p>
        <form className="form-stack" onSubmit={handleJoinWaitlist}>
          <input
            value={waitlistEmail}
            onChange={(e) => setWaitlistEmail(e.target.value)}
            name="waitlistEmail"
            placeholder="Email"
            type="email"
            required
          />
          <button className="primary-button auth-cta" disabled={waitlistLoading} type="submit">
            {waitlistLoading ? "Joining..." : "Join waitlist"}
          </button>
        </form>
        {waitlistStatus.type !== "idle" && (
          <div className={`status ${waitlistStatus.type}`}>
            {waitlistStatus.message}
          </div>
        )}
      </section>
      <div className="auth-meta">Powered by Nano Protocol • Instant settlement • Zero-fee</div>
    </div>
  );
}

