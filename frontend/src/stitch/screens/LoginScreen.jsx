import { Link } from "react-router-dom";
import BrandMark from "../components/BrandMark";

export default function LoginScreen({
  mode,
  onSubmit,
  loading,
  error
}) {
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
      <div className="auth-meta">Powered by Nano Protocol</div>
    </div>
  );
}

