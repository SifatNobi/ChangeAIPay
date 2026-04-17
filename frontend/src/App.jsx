import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://changeaipay.onrender.com";

const LOGO_URL = "https://imgur.com/a/5wQvzft";
const TOKEN_KEY = "changeaipay_token";

async function apiRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data?.error || "Request failed");
    error.details = data?.details || null;
    error.status = response.status;
    throw error;
  }

  return data;
}

function formatAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(6).replace(/\.?0+$/, "") : "0";
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || "";
}

function persistToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("token");
  }
}

function buildNanoUri(address, amount) {
  const safeAddress = String(address || "").trim();
  if (!safeAddress) return "";

  const safeAmount = String(amount || "").trim();
  return safeAmount
    ? `nano:${safeAddress}?amount=${encodeURIComponent(safeAmount)}`
    : `nano:${safeAddress}`;
}

function BrandMark({ size = 52 }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      {!failed ? (
        <img
          src={LOGO_URL}
          alt="logo"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>C</span>
      )}
    </div>
  );
}

function SafeText({ children, fallback = "—" }) {
  return <>{children ?? fallback}</>;
}

function TransactionItem({ transaction }) {
  const direction = String(transaction?.direction || "").toLowerCase();
  const isIncoming = direction.includes("in") || direction.includes("receive");
  const amount = formatAmount(transaction?.amountNano);
  const counterparty =
    transaction?.counterpart?.email ||
    transaction?.counterpart?.walletAddress ||
    "Unknown";

  return (
    <article className={`transaction-row ${isIncoming ? "incoming" : "outgoing"}`}>
      <div className="tx-icon">{isIncoming ? "↓" : "↑"}</div>
      <div className="tx-main">
        <p className="tx-amount">
          {isIncoming ? "+" : "-"}
          {amount} XNO
        </p>
        <p className="tx-meta">
          <SafeText>{counterparty}</SafeText>
        </p>
      </div>
      <div className="tx-state">{isIncoming ? "Confirmed" : "Sent"}</div>
    </article>
  );
}

function AuthForm({ mode, onSubmit, loading, error }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function update(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(form);
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
              <input name="name" placeholder="Name" onChange={update} required />
            )}
            <input name="email" placeholder="Email" onChange={update} required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              onChange={update}
              required
            />

            {error && <div className="status error">{error}</div>}

            <button className="primary-button auth-cta" disabled={loading}>
              {loading ? "Loading..." : mode}
            </button>
          </form>

          <p className="switch-copy">
            <Link className="ghost-link" to={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
            </Link>
          </p>
        </div>
      </div>
      <div className="auth-meta">Powered by Nano Protocol</div>
    </div>
  );
}

function ProtectedRoute({ bootStatus, token, children }) {
  const location = useLocation();

  if (bootStatus === "loading") return <div className="screen-center stitch-bg">Loading...</div>;

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function AppLayout({ profile, onLogout, children }) {
  const name = profile?.user?.name || "User";

  return (
    <div className="app-shell stitch-bg">
      <header className="topbar glass-card">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <strong className="brand-title">ChangeAIPay</strong>
        </div>

        <nav className="topnav">
          <NavLink className="nav-link" to="/dashboard">
            Home
          </NavLink>
          <NavLink className="nav-link" to="/send">
            Send
          </NavLink>
          <a className="nav-link" href="#receive">
            Receive
          </a>
          <a className="nav-link" href="#history">
            History
          </a>
        </nav>

        <button className="ghost-button" onClick={onLogout} type="button">
          Logout
        </button>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}

function DashboardPage({ profile, token }) {
  const [transactions, setTransactions] = useState([]);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    apiRequest("/transaction/history?limit=5", { token })
      .then((d) => setTransactions(d?.transactions || []))
      .catch(() => setTransactions([]));
  }, [token]);

  const balance = profile?.balance?.balanceNano || "0";
  const walletAddress =
    profile?.walletAddress ||
    profile?.user?.walletAddress ||
    profile?.balance?.walletAddress ||
    "";

  const receiveUri = useMemo(
    () => buildNanoUri(walletAddress, receiveAmount),
    [walletAddress, receiveAmount]
  );

  useEffect(() => {
    if (!receiveUri) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(receiveUri, { margin: 1, width: 320 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [receiveUri]);

  return (
    <div className="stack-lg stitch-bg stitch-dashboard-screen">
      <header className="merchant-header card glass-card stitch-dashboard-header">
        <div>
          <span className="eyebrow">Merchant HQ</span>
          <h1 className="merchant-name">{profile?.user?.name || "CyberNexus Systems"}</h1>
          <div className="wallet-chip">
            <span>wallet</span>
            <span className="mono">{walletAddress || "nano_3x...7u8"}</span>
          </div>
        </div>
        <div className="pill confirmed">Network: Live</div>
      </header>

      <section className="card hero-panel glass-card neon-sheen stitch-balance-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Current Treasury</span>
            <h1>Dashboard</h1>
          </div>
          <div className="pill confirmed">Live</div>
        </div>

        <p className="muted">Balance and recent activity for your ChangeAIPay wallet.</p>
        <div className="summary-card">
          <span className="eyebrow">Current Treasury</span>
          <strong>{formatAmount(balance)} XNO</strong>
        </div>
        <div className="hero-actions">
          <a className="primary-button action-pill" href="#receive">
            Generate QR
          </a>
          <a className="ghost-button action-pill" href="#history">
            History
          </a>
        </div>
      </section>

      <section className="receive-grid stitch-dual-grid">
        <article className="card qr-card glass-card stitch-receive-card" id="receive">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Receive</span>
              <h2>Payment QR</h2>
            </div>
          </div>

          <label className="field-label stitch-qr-label" htmlFor="receive-amount">
            Enter Amount (XNO)
          </label>
          <input
            id="receive-amount"
            name="receive-amount"
            value={receiveAmount}
            onChange={(e) => setReceiveAmount(e.target.value)}
            placeholder="0.00"
          />

          {qrDataUrl ? (
            <img alt="Payment QR code" src={qrDataUrl} />
          ) : (
            <div className="empty-qr">
              <p className="muted">Add amount to generate QR</p>
            </div>
          )}

          <div className="wallet-panel">
            <span className="wallet-label">Wallet Address</span>
            <code>{walletAddress || "Wallet not available in profile"}</code>
          </div>
        </article>

        <article className="card glass-card market-card stitch-market-card">
          <span className="eyebrow">History</span>
          <h2>Recent Flux</h2>
          <p className="muted">Ledger activity from your account.</p>
          <div className="market-bars">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="pill">{transactions.length} entries</div>
        </article>
      </section>

      <section className="card glass-card stitch-history-card" id="history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">History</span>
            <h2>Transactions</h2>
          </div>
        </div>

        <div className="list-grid">
          {transactions.length === 0 && (
            <div className="empty-state">No transactions yet.</div>
          )}

          {transactions.map((t, i) => (
            <TransactionItem key={i} transaction={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SendPage({ token }) {
  const [form, setForm] = useState({ recipient: "", amount: "" });

  async function submit(e) {
    e.preventDefault();

    await apiRequest("/transaction/send", {
      method: "POST",
      token,
      body: form
    });

    setForm({ recipient: "", amount: "" });
  }

  return (
    <div className="stack-lg stitch-bg stitch-send-screen">
      <section className="card form-card glass-card send-surface stitch-send-card">
        <span className="eyebrow">Quick Transfer</span>
        <h1>Send Nano</h1>
        <p className="muted">Real-time transfer with zero-fee Nano settlement.</p>

        <form onSubmit={submit}>
          <input
            name="recipient"
            onChange={(e) => setForm({ ...form, recipient: e.target.value })}
            placeholder="Recipient (email or Nano address)"
            value={form.recipient}
          />
          <input
            name="amount"
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Amount (XNO)"
            value={form.amount}
          />
          <button className="primary-button" type="submit">
            Send
          </button>
        </form>
      </section>
    </div>
  );
}

function App() {
  const navigate = useNavigate();

  const [token, setToken] = useState(getStoredToken());
  const [profile, setProfile] = useState(null);
  const [bootStatus, setBootStatus] = useState("idle");

  const logout = useCallback(() => {
    persistToken("");
    setToken("");
    setProfile(null);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!token) return;

    setBootStatus("loading");

    apiRequest("/user/profile", { token })
      .then((d) => {
        setProfile(d || {});
        setBootStatus("ready");
      })
      .catch(() => {
        setProfile(null);
        setBootStatus("idle");
        persistToken("");
      });
  }, [token]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/dashboard" />
          ) : (
            <AuthForm mode="login" onSubmit={() => {}} />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout profile={profile} onLogout={logout}>
              <DashboardPage profile={profile} token={token} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/send"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <SendPage token={token} />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;