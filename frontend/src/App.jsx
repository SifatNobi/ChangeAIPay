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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://changeaipay.onrender.com";
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

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
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
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
}

function buildNanoUri(address, amount) {
  const safeAddress = String(address || "").trim();
  if (!safeAddress) return "";

  const safeAmount = String(amount || "").trim();
  return safeAmount ? `nano:${safeAddress}?amount=${encodeURIComponent(safeAmount)}` : `nano:${safeAddress}`;
}

function BrandMark({ size = 52 }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="brand-mark"
      style={{ width: size, height: size }}
      aria-label="ChangeAIPay logo"
      role="img"
    >
      {!failed ? (
        <img
          src={LOGO_URL}
          alt="ChangeAIPay logo"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>C</span>
      )}
    </div>
  );
}

function LoadingScreen({ message = "Loading ChangeAIPay..." }) {
  return (
    <div className="screen-center">
      <BrandMark size={72} />
      <h1>ChangeAIPay</h1>
      <p>{message}</p>
    </div>
  );
}

function AuthForm({ mode, onSubmit, loading, error }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="hero-copy">
          <BrandMark size={64} />
          <span className="eyebrow">Nano fintech prototype</span>
          <h1>Instant zero-fee payments, rebuilt for a stable demo.</h1>
          <p>
            Register, keep a session alive, send Nano to another user, and inspect persistent
            transaction history without the old multi-page flicker.
          </p>
        </div>

        <form className="card auth-card" onSubmit={submit}>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Use your email and password to restore your ChangeAIPay session."
              : "A Nano wallet will be created for this account during registration."}
          </p>

          {mode === "register" ? (
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                name="name"
                onChange={updateField}
                placeholder="Ava Merchant"
                required
                type="text"
                value={form.name}
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              onChange={updateField}
              placeholder="merchant@changeaipay.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              name="password"
              onChange={updateField}
              placeholder="At least 8 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <div className="status error">{error}</div> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Working..." : mode === "login" ? "Login" : "Register"}
          </button>

          <p className="muted switch-copy">
            {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Register" : "Login"}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function ProtectedRoute({ bootStatus, token, children }) {
  const location = useLocation();

  if (bootStatus === "loading") {
    return <LoadingScreen message="Restoring secure session..." />;
  }

  if (!token) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return children;
}

function AppLayout({ profile, onLogout, children }) {
  const navigation = useMemo(
    () => [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/send", label: "Send" },
      { to: "/receive", label: "Receive" },
      { to: "/history", label: "History" }
    ],
    []
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandMark size={44} />
          <div>
            <span className="eyebrow">ChangeAIPay</span>
            <strong>{profile?.user?.name || "YC Demo Wallet"}</strong>
          </div>
        </div>

        <nav className="topnav">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="ghost-button" onClick={onLogout} type="button">
          Logout
        </button>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <article className="card summary-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p className="muted">{helper}</p>
    </article>
  );
}

function TransactionList({ transactions, emptyMessage }) {
  if (!transactions.length) {
    return <div className="card empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="list-grid">
      {transactions.map((transaction) => (
        <article className="card transaction-card" key={transaction.id || transaction.txHash}>
          <div>
            <span className="eyebrow">
              {transaction.direction === "outgoing" ? "Sent" : "Received"}
            </span>
            <h3>{formatAmount(transaction.amountNano)} XNO</h3>
            <p className="muted">
              {transaction.counterpart.email || transaction.counterpart.walletAddress || "Unknown"}
            </p>
          </div>

          <div className="transaction-meta">
            <span className={`pill ${transaction.status}`}>{transaction.status}</span>
            <span className="muted">{new Date(transaction.timestamp).toLocaleString()}</span>
            {transaction.txHash ? <code>{transaction.txHash}</code> : null}
            {transaction.errorMessage ? (
              <span className="inline-error">{transaction.errorMessage}</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function DashboardPage({ token, profile }) {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiRequest("/transaction/history?limit=5", { token })
      .then((data) => {
        if (!cancelled) {
          setTransactions(data.transactions || []);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const balance = profile?.balance?.balanceNano || "0";
  const pending = profile?.balance?.pendingNano || "0";

  return (
    <section className="stack-lg">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">Wallet overview</span>
          <h1>Stable fintech flows for the demo stage.</h1>
          <p className="muted">
            Your session, Nano wallet address, and transaction ledger are all loaded from the live
            backend API.
          </p>
        </div>
        <div className="hero-metrics">
          <SummaryCard
            label="Available balance"
            value={`${formatAmount(balance)} XNO`}
            helper="Live Nano account balance from the backend RPC service."
          />
          <SummaryCard
            label="Pending"
            value={`${formatAmount(pending)} XNO`}
            helper="Pending Nano value waiting to settle."
          />
          <SummaryCard
            label="Wallet address"
            value={profile?.user?.walletAddress || "Unavailable"}
            helper={`Status: ${profile?.user?.walletStatus || "unknown"}`}
          />
        </div>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Recent activity</span>
            <h2>Latest transactions</h2>
          </div>
          <Link className="ghost-link" to="/history">
            View full history
          </Link>
        </div>
        {error ? <div className="status error">{error}</div> : null}
        <TransactionList emptyMessage="No transactions recorded yet." transactions={transactions} />
      </section>
    </section>
  );
}

function SendPage({ token }) {
  const [form, setForm] = useState({ recipient: "", amount: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const data = await apiRequest("/transaction/send", {
        method: "POST",
        token,
        body: form
      });
      setSuccess(data.transaction);
      setForm({ recipient: "", amount: "" });
    } catch (requestError) {
      const detail = requestError.details ? ` ${requestError.details}` : "";
      setError(`${requestError.message}.${detail}`.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Send Nano</span>
          <h1>Transfer Nano instantly to another user.</h1>
        </div>
      </div>

      <form className="card form-card" onSubmit={submit}>
        <label>
          <span>Recipient email or wallet address</span>
          <input
            name="recipient"
            onChange={update}
            placeholder="merchant@changeaipay.com or nano_..."
            required
            type="text"
            value={form.recipient}
          />
        </label>
        <label>
          <span>Amount (XNO)</span>
          <input
            inputMode="decimal"
            name="amount"
            onChange={update}
            placeholder="0.25"
            required
            type="text"
            value={form.amount}
          />
        </label>
        {error ? <div className="status error">{error}</div> : null}
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? "Sending..." : "Send Nano"}
        </button>
      </form>

      {success ? (
        <div className="card">
          <span className="eyebrow">Transfer result</span>
          <h2>{success.status === "confirmed" ? "Transaction confirmed" : "Transaction submitted"}</h2>
          <p className="muted">
            {formatAmount(success.amountNano)} XNO to{" "}
            {success.counterpart.email || success.counterpart.walletAddress}
          </p>
          {success.txHash ? <code>{success.txHash}</code> : null}
        </div>
      ) : null}
    </section>
  );
}

function ReceivePage({ profile }) {
  const [amount, setAmount] = useState("");
  const [qrCode, setQrCode] = useState("");
  const address = profile?.user?.walletAddress || "";

  useEffect(() => {
    let cancelled = false;
    const uri = buildNanoUri(address, amount);

    if (!uri) {
      setQrCode("");
      return undefined;
    }

    QRCode.toDataURL(uri, {
      margin: 1,
      color: {
        dark: "#54c3ff",
        light: "#0e0e0e"
      }
    })
      .then((url) => {
        if (!cancelled) {
          setQrCode(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCode("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, amount]);

  return (
    <section className="receive-grid">
      <div className="card form-card">
        <span className="eyebrow">Receive Nano</span>
        <h1>Share a wallet QR for incoming payments.</h1>
        <label>
          <span>Optional amount (XNO)</span>
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            type="text"
            value={amount}
          />
        </label>
        <div className="wallet-panel">
          <span className="muted">Wallet address</span>
          <code>{address || "Wallet unavailable"}</code>
        </div>
      </div>

      <div className="card qr-card">
        {qrCode ? <img alt="Nano payment QR code" src={qrCode} /> : <div className="empty-qr" />}
        <p className="muted">URI: {buildNanoUri(address, amount) || "Nano wallet unavailable"}</p>
      </div>
    </section>
  );
}

function HistoryPage({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");

    apiRequest("/transaction/history", { token })
      .then((data) => {
        if (!cancelled) {
          setTransactions(data.transactions || []);
          setStatus("ready");
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message);
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <span className="eyebrow">History</span>
          <h1>Persistent transaction ledger</h1>
        </div>
      </div>

      {status === "loading" ? <div className="card empty-state">Loading transactions...</div> : null}
      {status === "error" ? <div className="status error">{error}</div> : null}
      {status === "ready" ? (
        <TransactionList
          emptyMessage="No transactions have been persisted for this wallet yet."
          transactions={transactions}
        />
      ) : null}
    </section>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(() => getStoredToken());
  const [profile, setProfile] = useState(null);
  const [bootStatus, setBootStatus] = useState(() => (getStoredToken() ? "loading" : "idle"));
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const setSessionToken = useCallback((nextToken) => {
    persistToken(nextToken);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    setProfile(null);
    setAuthError("");
    setSessionToken("");
    navigate("/login", { replace: true });
  }, [navigate, setSessionToken]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setProfile(null);
      setBootStatus("idle");
      return undefined;
    }

    setBootStatus("loading");
    setAuthError("");

    apiRequest("/user/profile", { token })
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setBootStatus("ready");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProfile(null);
          setBootStatus("idle");
          setAuthError(error.message);
          setSessionToken("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, setSessionToken]);

  async function handleAuth(path, values) {
    setAuthSubmitting(true);
    setAuthError("");

    try {
      const body =
        path === "/auth/register"
          ? {
              name: values.name,
              email: values.email,
              password: values.password
            }
          : {
              email: values.email,
              password: values.password
            };

      const data = await apiRequest(path, {
        method: "POST",
        body
      });

      setSessionToken(data.token);
      setProfile((current) => current || { user: data.user, balance: null });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const detail = error.details ? ` ${error.details}` : "";
      setAuthError(`${error.message}.${detail}`.trim());
    } finally {
      setAuthSubmitting(false);
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token && bootStatus === "ready" ? (
            <Navigate replace to="/dashboard" />
          ) : (
            <AuthForm
              error={authError}
              loading={authSubmitting}
              mode="login"
              onSubmit={(values) => handleAuth("/auth/login", values)}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          token && bootStatus === "ready" ? (
            <Navigate replace to="/dashboard" />
          ) : (
            <AuthForm
              error={authError}
              loading={authSubmitting}
              mode="register"
              onSubmit={(values) => handleAuth("/auth/register", values)}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout onLogout={logout} profile={profile}>
              <DashboardPage profile={profile} token={token} />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/send"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout onLogout={logout} profile={profile}>
              <SendPage token={token} />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/receive"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout onLogout={logout} profile={profile}>
              <ReceivePage profile={profile} />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout onLogout={logout} profile={profile}>
              <HistoryPage token={token} />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <Navigate
            replace
            to={token && (bootStatus === "loading" || bootStatus === "ready") ? "/dashboard" : "/login"}
          />
        }
      />
      <Route
        path="*"
        element={<Navigate replace to={location.pathname.startsWith("/login") ? "/login" : "/"} />}
      />
    </Routes>
  );
}

export default App;
