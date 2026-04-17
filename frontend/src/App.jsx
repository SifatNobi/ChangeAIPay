import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";

import {
  clearToken,
  getToken,
  getTransactionHistory,
  getUserProfile,
  login,
  register,
  sendTransaction,
  setToken
} from "./api";

import AppLayout from "./stitch/components/AppLayout";
import ProtectedRoute from "./stitch/components/ProtectedRoute";
import DashboardScreen from "./stitch/screens/DashboardScreen";
import LoginScreen from "./stitch/screens/LoginScreen";
import SendScreen from "./stitch/screens/SendScreen";

function App() {
  const navigate = useNavigate();

  const [token, setTokenState] = useState(getToken());
  const [profile, setProfile] = useState(null);
  const [bootStatus, setBootStatus] = useState("idle");
  const [authStatus, setAuthStatus] = useState({ loading: false, error: "" });

  const logout = useCallback(() => {
    clearToken();
    setTokenState("");
    setProfile(null);
    navigate("/login");
  }, [navigate]);

  const loadProfile = useCallback(async () => {
    if (!token) return null;
    const data = await getUserProfile(token);
    setProfile(data || {});
    return data;
  }, [token]);

  const loadHistory = useCallback(
    async ({ limit } = {}) => {
      if (!token) throw new Error("Missing token");
      return getTransactionHistory(token, { limit });
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;

    setBootStatus("loading");

    loadProfile()
      .then(() => setBootStatus("ready"))
      .catch(() => {
        setProfile(null);
        setBootStatus("idle");
        clearToken();
        setTokenState("");
      });
  }, [token, loadProfile]);

  const handleAuthSubmit = useCallback(
    async (mode, payload, redirectTo) => {
      setAuthStatus({ loading: true, error: "" });
      try {
        const data = mode === "register" ? await register(payload) : await login(payload);
        const nextToken = data?.token || "";
        if (!nextToken) throw new Error("Missing token from server");
        setToken(nextToken);
        setTokenState(nextToken);
        await loadProfile().catch(() => null);
        navigate(redirectTo || "/dashboard", { replace: true });
      } catch (err) {
        setAuthStatus({ loading: false, error: err?.message || "Authentication failed" });
        return;
      } finally {
        setAuthStatus((s) => ({ ...s, loading: false }));
      }
    },
    [loadProfile, navigate]
  );

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/dashboard" />
          ) : (
            <LoginGate
              mode="login"
              authStatus={authStatus}
              onSubmit={(payload, redirectTo) =>
                handleAuthSubmit("login", payload, redirectTo)
              }
            />
          )
        }
      />

      <Route
        path="/register"
        element={
          token ? (
            <Navigate to="/dashboard" />
          ) : (
            <LoginGate
              mode="register"
              authStatus={authStatus}
              onSubmit={(payload, redirectTo) =>
                handleAuthSubmit("register", payload, redirectTo)
              }
            />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <AppLayout profile={profile} onLogout={logout}>
              <DashboardScreen profile={profile} token={token} loadHistory={loadHistory} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/send"
        element={
          <ProtectedRoute bootStatus={bootStatus} token={token}>
            <SendScreen
              sendTransaction={(payload) => {
                if (!token) throw new Error("Missing token");
                return sendTransaction(token, payload);
              }}
            />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;

function LoginGate({ mode, authStatus, onSubmit }) {
  const location = useLocation();
  const from = location.state?.from || "/dashboard";
  const redirectTo = useMemo(() => (typeof from === "string" ? from : "/dashboard"), [from]);

  return (
    <LoginScreen
      mode={mode}
      loading={authStatus.loading}
      error={authStatus.error}
      onSubmit={(payload) => onSubmit(payload, redirectTo)}
    />
  );
}