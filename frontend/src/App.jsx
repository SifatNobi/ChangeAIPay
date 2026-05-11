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
import LoginScreen from "./stitch/screens/LoginScreen";
import SendScreen from "./stitch/screens/SendScreen";
import PricingScreen from "./stitch/screens/PricingScreen";
import MerchantPricingScreen from "./stitch/screens/MerchantPricingScreen";
import WaitlistScreen from "./stitch/screens/WaitlistScreen";
import AIAssistant from "./components/AIAssistant";
import UserDashboard from "./components/UserDashboard";
import MerchantDashboard from "./components/MerchantDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { QRPaymentScanner } from "./components/QRSystem";
import { UserOnboarding, MerchantOnboarding } from "./components/OnboardingFlow";

function App() {
  const navigate = useNavigate();

  const [token, setTokenState] = useState(getToken());
  const [profile, setProfile] = useState(null);
  const [bootStatus, setBootStatus] = useState("idle");
  const [authStatus, setAuthStatus] = useState({ loading: false, error: "" });
  const [onboardingComplete, setOnboardingComplete] = useState(
    localStorage.getItem("changeaipay_onboarding") === "true"
  );
  const [paymentContext, setPaymentContext] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("changeaipay_payment_context") || "null");
    } catch {
      return null;
    }
  });

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

  const storePaymentContext = useCallback((context) => {
    try {
      const saved = { ...context, savedAt: new Date().toISOString() };
      localStorage.setItem("changeaipay_payment_context", JSON.stringify(saved));
      setPaymentContext(saved);
    } catch {
      setPaymentContext(context);
    }
  }, []);

  const clearPaymentContext = useCallback(() => {
    localStorage.removeItem("changeaipay_payment_context");
    setPaymentContext(null);
  }, []);

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

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("changeaipay_onboarding", "true");
    setOnboardingComplete(true);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <>
      <AIAssistant userId={profile?.id} paymentContext={paymentContext} onNavigate={navigate} />
      <Routes>
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} />} />

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

        <Route path="/waitlist" element={<WaitlistScreen />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                {profile?.role === "admin" ? (
                  <AdminDashboard token={token} onNavigate={navigate} />
                ) : profile?.role === "merchant" ? (
                  <MerchantDashboard
                    profile={profile}
                    token={token}
                    loadHistory={loadHistory}
                    onNavigate={navigate}
                  />
                ) : (
                  <UserDashboard
                    profile={profile}
                    token={token}
                    loadHistory={loadHistory}
                    onNavigate={navigate}
                  />
                )}
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pricing"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <PricingScreen
                  currentPlan={profile?.subscription?.plan}
                  onSelectPlan={() => {}}
                  onNavigate={navigate}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/merchant-pricing"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <MerchantPricingScreen onNavigate={navigate} />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/qr"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <QRPaymentScanner
                  onPaymentReady={(payment) => {
                    storePaymentContext(payment);
                    navigate("/send", { state: payment });
                  }}
                  onCancel={() => navigate("/dashboard")}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                {profile?.role === "admin" ? (
                  <AdminDashboard token={token} onNavigate={navigate} />
                ) : (
                  <div className="access-denied card glass-card">
                    <h1>Access Denied</h1>
                    <p>This area is reserved for admin users.</p>
                  </div>
                )}
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                {profile?.role === "merchant" ? (
                  <MerchantOnboarding
                    onComplete={handleOnboardingComplete}
                    businessInfo={profile?.user}
                  />
                ) : (
                  <UserOnboarding onComplete={handleOnboardingComplete} />
                )}
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/send"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <SendScreen
                  paymentContext={paymentContext}
                  onClearContext={clearPaymentContext}
                  sendTransaction={(payload) => {
                    if (!token) throw new Error("Missing token");
                    return sendTransaction(token, payload);
                  }}
                />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} />} />
      </Routes>
    </>
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