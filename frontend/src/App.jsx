import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
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
import WaitlistScreen from "./stitch/screens/WaitlistScreen";
import { QRPaymentScanner } from "./components/QRSystem";
import AIAssistant from "./components/AIAssistant";
import { UserOnboarding, MerchantOnboarding } from "./components/OnboardingFlow";

const UserDashboard = React.lazy(() => import("./components/UserDashboard"));
const MerchantDashboard = React.lazy(() => import("./components/MerchantDashboard"));
const AdminDashboard = React.lazy(() => import("./components/AdminDashboard"));
const PricingScreen = React.lazy(() => import("./stitch/screens/PricingScreen"));
const MerchantPricingScreen = React.lazy(() => import("./stitch/screens/MerchantPricingScreen"));
const SendScreen = React.lazy(() => import("./stitch/screens/SendScreen"));
const PricingCheckout = React.lazy(() => import("./components/PricingCheckout"));
const HistoryScreen = React.lazy(() => import("./stitch/screens/HistoryScreen"));

const LoadingFallback = React.memo(() => (
  <div className="loading-spinner" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
    <div className="spinner" />
  </div>
));

const LazyWrapper = React.memo(({ children }) => (
  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
));

const MemoizedLoginGate = React.memo(LoginGate);
const MemoizedWaitlistScreen = React.memo(WaitlistScreen);
const MemoizedQRPaymentScanner = React.memo(QRPaymentScanner);

function App() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const stableNavigate = useCallback((...args) => navigateRef.current(...args), []);

  const [token, setTokenState] = useState(() => {
    const cached = sessionStorage.getItem("changeaipay_session");
    if (cached) {
      try {
        const { token: t, expires } = JSON.parse(cached);
        if (expires && Date.now() < expires) return t;
        sessionStorage.removeItem("changeaipay_session");
      } catch {}
    }
    return getToken();
  });
  const [profile, setProfile] = useState(() => {
    const cached = sessionStorage.getItem("changeaipay_profile");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
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

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const cacheProfile = useCallback((data) => {
    setProfile(data || {});
    try {
      sessionStorage.setItem("changeaipay_profile", JSON.stringify(data || {}));
    } catch {}
  }, []);

  const cacheSession = useCallback((t) => {
    try {
      const session = { token: t, expires: Date.now() + 24 * 60 * 60 * 1000 };
      sessionStorage.setItem("changeaipay_session", JSON.stringify(session));
    } catch {}
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState("");
    setProfile(null);
    sessionStorage.removeItem("changeaipay_session");
    sessionStorage.removeItem("changeaipay_profile");
    navigate("/login");
  }, [navigate]);

  const loadProfile = useCallback(async (forceRefresh = false) => {
    if (!token) return null;
    if (!forceRefresh && profileRef.current) return profileRef.current;
    const data = await getUserProfile(token);
    cacheProfile(data);
    return data;
  }, [token, cacheProfile]);

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
        sessionStorage.removeItem("changeaipay_session");
        sessionStorage.removeItem("changeaipay_profile");
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
        cacheSession(nextToken);
        await loadProfile().catch(() => null);
        navigate(redirectTo || "/dashboard", { replace: true });
      } catch (err) {
        setAuthStatus({ loading: false, error: err?.message || "Authentication failed" });
        return;
      } finally {
        setAuthStatus((s) => ({ ...s, loading: false }));
      }
    },
    [loadProfile, navigate, cacheSession]
  );

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("changeaipay_onboarding", "true");
    setOnboardingComplete(true);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleSelectPlan = useCallback((planId) => navigate(`/checkout/${planId}`), [navigate]);
  const handleCheckoutCancel = useCallback(() => navigate("/pricing"), [navigate]);
  const handleQRPaymentReady = useCallback((payment) => {
    storePaymentContext(payment);
    navigate("/send", { state: payment });
  }, [navigate, storePaymentContext]);
  const handleQRCancel = useCallback(() => navigate("/dashboard"), [navigate]);
  const handleSendTransaction = useCallback((payload) => {
    if (!token) throw new Error("Missing token");
    return sendTransaction(token, payload);
  }, [token]);
  const handleCheckoutComplete = useCallback((result) => {
    loadProfile(true);
    navigate("/dashboard");
  }, [loadProfile, navigate]);

  const memoizedCheckoutWrapper = useMemo(() => (
    <MemoizedCheckoutRouteWrapper
      profile={profile}
      loadProfile={() => loadProfile(true)}
      onNavigate={navigate}
    />
  ), [profile, loadProfile, navigate]);

  const memoizedSendTransaction = useMemo(() => (
    <SendScreen
      paymentContext={paymentContext}
      onClearContext={clearPaymentContext}
      sendTransaction={handleSendTransaction}
    />
  ), [paymentContext, clearPaymentContext, handleSendTransaction]);

  const handleLoginSubmit = useCallback((payload, redirectTo) =>
    handleAuthSubmit("login", payload, redirectTo), [handleAuthSubmit]);
  const handleRegisterSubmit = useCallback((payload, redirectTo) =>
    handleAuthSubmit("register", payload, redirectTo), [handleAuthSubmit]);

  const memoizedLoginRoute = useMemo(() => (
    <MemoizedLoginGate
      mode="login"
      authStatus={authStatus}
      onSubmit={handleLoginSubmit}
    />
  ), [authStatus, handleLoginSubmit]);

  const memoizedRegisterRoute = useMemo(() => (
    <MemoizedLoginGate
      mode="register"
      authStatus={authStatus}
      onSubmit={handleRegisterSubmit}
    />
  ), [authStatus, handleRegisterSubmit]);

  const dashboardContent = useMemo(() => {
    if (profile?.role === "admin") {
      return <AdminDashboard token={token} onNavigate={stableNavigate} />;
    }
    if (profile?.role === "merchant") {
      return (
        <MerchantDashboard
          profile={profile}
          token={token}
          loadHistory={loadHistory}
          onNavigate={stableNavigate}
        />
      );
    }
    return (
      <UserDashboard
        profile={profile}
        token={token}
        loadHistory={loadHistory}
        onNavigate={stableNavigate}
      />
    );
  }, [profile, token, loadHistory, stableNavigate]);

  return (
    <>
      <AIAssistant userId={profile?.id} subscription={profile?.subscription} paymentContext={paymentContext} onNavigate={navigate} />
      <Routes>
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} />} />

        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/dashboard" />
            ) : (
              memoizedLoginRoute
            )
          }
        />

        <Route
          path="/register"
          element={
            token ? (
              <Navigate to="/dashboard" />
            ) : (
              memoizedRegisterRoute
            )
          }
        />

        <Route path="/waitlist" element={<MemoizedWaitlistScreen />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <LazyWrapper>{dashboardContent}</LazyWrapper>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pricing"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <LazyWrapper>
                  <PricingScreen
                    currentPlan={profile?.subscription?.plan}
                    onSelectPlan={handleSelectPlan}
                    onNavigate={navigate}
                    userRole={profile?.role}
                  />
                </LazyWrapper>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/checkout/:plan"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <LazyWrapper>
                  {memoizedCheckoutWrapper}
                </LazyWrapper>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/merchant-pricing"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <LazyWrapper>
                  <MerchantPricingScreen onNavigate={navigate} />
                </LazyWrapper>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/qr"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <MemoizedQRPaymentScanner
                  onPaymentReady={handleQRPaymentReady}
                  onCancel={handleQRCancel}
                  walletAddress={profile?.walletAddress || profile?.user?.walletAddress || profile?.balance?.walletAddress || ""}
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
                  <LazyWrapper>
                    <AdminDashboard token={token} onNavigate={stableNavigate} />
                  </LazyWrapper>
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
                <LazyWrapper>
                  {memoizedSendTransaction}
                </LazyWrapper>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute bootStatus={bootStatus} token={token}>
              <AppLayout profile={profile} onLogout={logout}>
                <LazyWrapper>
                  <HistoryScreen token={token} loadHistory={loadHistory} />
                </LazyWrapper>
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

function CheckoutRouteWrapper({ profile, loadProfile, onNavigate }) {
  const { plan } = useParams();
  const handleComplete = useCallback((result) => {
    loadProfile();
    onNavigate("/dashboard");
  }, [loadProfile, onNavigate]);

  const handleCancel = useCallback(() => onNavigate("/pricing"), [onNavigate]);

  return (
    <PricingCheckout
      selectedPlan={plan}
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );
}

const MemoizedCheckoutRouteWrapper = React.memo(CheckoutRouteWrapper);
