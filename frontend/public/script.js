const API_BASE_URL =
  (window.CHANGEAIPAY_API_BASE_URL || "https://changeaipay.onrender.com/api").replace(/\/+$/, "");
const TOKEN_KEY = "changeaipay_token";
const VIDEO_VOLUME = 1;

const ui = {};
let authMode = "login";

function byId(id) {
  return document.getElementById(id);
}

function cacheElements() {
  ui.authSection = byId("auth-section");
  ui.dashboardSection = byId("dashboard-section");
  ui.authTitle = byId("auth-title");
  ui.authForm = byId("auth-form");
  ui.authError = byId("auth-error");
  ui.authSubmit = byId("auth-submit");
  ui.switchAuth = byId("switch-auth");
  ui.registerFields = byId("register-fields");
  ui.nameInput = ui.authForm?.elements?.namedItem("name");
  ui.emailInput = ui.authForm?.elements?.namedItem("email");
  ui.passwordInput = ui.authForm?.elements?.namedItem("password");
  ui.waitlistForm = byId("waitlist-form");
  ui.waitlistEmail = byId("waitlist-email");
  ui.waitlistStatus = byId("waitlist-status");
  ui.merchantName = byId("merchant-name");
  ui.walletAddress = byId("wallet-address");
  ui.receiveWalletAddress = byId("receive-wallet-address");
  ui.logoutBtn = byId("logout-btn");
  ui.mobileLogoutBtn = byId("mobile-logout-btn");
  ui.hamburgerBtn = byId("hamburger-btn");
  ui.mobileMenu = byId("mobile-menu");
  ui.demoVideo = byId("demo-video");
  ui.muteBtn = byId("mute-btn");
  ui.soundBtn = byId("sound-btn");
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || "";
}

function setToken(token) {
  if (!token) {
    clearToken();
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
}

function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  const isRegister = authMode === "register";

  if (ui.registerFields) {
    ui.registerFields.style.display = isRegister ? "block" : "none";
  }
  if (ui.nameInput) {
    ui.nameInput.required = isRegister;
    if (!isRegister) ui.nameInput.value = "";
  }
  if (ui.authTitle) {
    ui.authTitle.textContent = isRegister ? "Register" : "Login";
  }
  if (ui.authSubmit) {
    ui.authSubmit.textContent = isRegister ? "Create account" : "Login";
  }
  if (ui.switchAuth) {
    ui.switchAuth.textContent = isRegister
      ? "Already have an account? Login"
      : "Need an account? Register";
  }
  setAuthError("");
}

function setAuthLoading(isLoading) {
  if (!ui.authSubmit) return;

  ui.authSubmit.disabled = isLoading;
  if (isLoading) {
    ui.authSubmit.dataset.defaultText = ui.authSubmit.dataset.defaultText || ui.authSubmit.textContent;
    ui.authSubmit.textContent = "Please wait...";
    return;
  }

  ui.authSubmit.textContent =
    ui.authSubmit.dataset.defaultText ||
    (authMode === "register" ? "Create account" : "Login");
}

function setAuthError(message) {
  if (!ui.authError) return;
  const value = String(message || "").trim();
  ui.authError.textContent = value;
  ui.authError.style.display = value ? "block" : "none";
}

function setWaitlistStatus(message, isError = false) {
  if (!ui.waitlistStatus) return;
  const value = String(message || "").trim();

  ui.waitlistStatus.textContent = value;
  ui.waitlistStatus.style.display = value ? "block" : "none";
  ui.waitlistStatus.classList.toggle("error", Boolean(value && isError));
}

function showAuthView() {
  if (ui.authSection) ui.authSection.style.display = "";
  if (ui.dashboardSection) ui.dashboardSection.style.display = "none";
}

function showDashboardView() {
  if (ui.authSection) ui.authSection.style.display = "none";
  if (ui.dashboardSection) ui.dashboardSection.style.display = "";
}

function updateProfileUi(user) {
  const name = user?.name || "ChangeAIPay User";
  const address = user?.walletAddress || "Wallet not available";

  if (ui.merchantName) ui.merchantName.textContent = name;
  if (ui.walletAddress) ui.walletAddress.textContent = address;
  if (ui.receiveWalletAddress) ui.receiveWalletAddress.textContent = address;
}

async function apiRequest(path, { method = "GET", token = "", body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!ui.authForm) return;

  const name = String(ui.nameInput?.value || "").trim();
  const email = String(ui.emailInput?.value || "").trim().toLowerCase();
  const password = String(ui.passwordInput?.value || "");

  if (!email || !password) {
    setAuthError("Email and password are required");
    return;
  }

  if (authMode === "register" && !name) {
    setAuthError("Name is required");
    return;
  }

  setAuthError("");
  setAuthLoading(true);

  try {
    const payload =
      authMode === "register" ? { name, email, password } : { email, password };
    const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
    const authData = await apiRequest(endpoint, {
      method: "POST",
      body: payload
    });

    const token = String(authData?.token || "");
    if (!token) {
      throw new Error("Login succeeded but no token was returned");
    }

    setToken(token);
    const profileData = await apiRequest("/user/profile", { token });
    updateProfileUi(profileData?.user || authData?.user || null);
    showDashboardView();
    ui.authForm.reset();
    setAuthMode("login");
  } catch (error) {
    setAuthError(error?.message || "Authentication failed");
  } finally {
    setAuthLoading(false);
  }
}

async function handleWaitlistSubmit(event) {
  event.preventDefault();

  const email = String(ui.waitlistEmail?.value || "").trim().toLowerCase();
  if (!email) {
    setWaitlistStatus("Email is required", true);
    return;
  }

  setWaitlistStatus("");

  try {
    await apiRequest("/waitlist", {
      method: "POST",
      body: { email }
    });
    setWaitlistStatus("You are on the waitlist");
    if (ui.waitlistForm) ui.waitlistForm.reset();
  } catch (error) {
    setWaitlistStatus(error?.message || "Failed to join waitlist", true);
  }
}

function handleLogout() {
  clearToken();
  showAuthView();
}

function setupAuthEvents() {
  if (ui.authForm) ui.authForm.addEventListener("submit", handleAuthSubmit);
  if (ui.waitlistForm) ui.waitlistForm.addEventListener("submit", handleWaitlistSubmit);
  if (ui.switchAuth) {
    ui.switchAuth.addEventListener("click", (event) => {
      event.preventDefault();
      setAuthMode(authMode === "register" ? "login" : "register");
    });
  }
  if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", handleLogout);
  if (ui.mobileLogoutBtn) ui.mobileLogoutBtn.addEventListener("click", handleLogout);
}

function setupMobileMenu() {
  if (!ui.hamburgerBtn || !ui.mobileMenu) return;
  ui.hamburgerBtn.addEventListener("click", () => {
    ui.mobileMenu.style.display = ui.mobileMenu.style.display === "flex" ? "none" : "flex";
  });
}

function initializeVideoState() {
  if (!ui.demoVideo) return;

  ui.demoVideo.muted = true;
  ui.demoVideo.volume = VIDEO_VOLUME;
  ui.demoVideo.addEventListener("error", (event) => {
    console.error("Demo video error:", event.target?.error);
  });

  document.addEventListener("click", handleUserInteraction, { once: true });
  document.addEventListener("touchstart", handleUserInteraction, { once: true });
}

async function handleUserInteraction() {
  if (!ui.demoVideo) return;
  try {
    await ui.demoVideo.play();
  } catch (error) {
    console.warn("User interaction did not unlock video immediately:", error);
  }
}

function tryManualAudioUnlock() {
  try {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextImpl) return;

    const context = new AudioContextImpl();
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
  } catch (error) {
    console.warn("Web Audio manual unlock failed:", error);
  }
}

function syncVideoButtonState() {
  if (!ui.demoVideo) return;

  if (ui.muteBtn) {
    ui.muteBtn.textContent = ui.demoVideo.muted ? "Unmute" : "Mute";
  }
  if (ui.soundBtn && !ui.demoVideo.muted) {
    ui.soundBtn.textContent = "Sound On";
  }
}

async function unlockVideoAudio() {
  if (!ui.demoVideo) return false;

  ui.demoVideo.muted = false;
  ui.demoVideo.volume = VIDEO_VOLUME;

  try {
    await ui.demoVideo.play();
  } catch (firstError) {
    console.warn("unlockVideoAudio attempt failed:", firstError);
    try {
      await ui.demoVideo.play();
    } catch (retryError) {
      console.warn("unlockVideoAudio retry failed:", retryError);
    }
  }

  setTimeout(() => {
    if (!ui.demoVideo) return;
    if (ui.demoVideo.muted) ui.demoVideo.muted = false;
    if (ui.demoVideo.volume < VIDEO_VOLUME) ui.demoVideo.volume = VIDEO_VOLUME;
    syncVideoButtonState();
  }, 100);

  return !ui.demoVideo.muted;
}

async function toggleVideoMute(event) {
  if (event?.cancelable) event.preventDefault();
  if (!ui.demoVideo) return;

  ui.demoVideo.muted = !ui.demoVideo.muted;
  if (!ui.demoVideo.muted) {
    await unlockVideoAudio();
  }
  syncVideoButtonState();
}

async function toggleVideoSound(event) {
  if (event?.cancelable) event.preventDefault();
  if (!ui.demoVideo) return;

  const enabled = await unlockVideoAudio();
  if (enabled) {
    if (ui.soundBtn) ui.soundBtn.textContent = "Sound On";
    if (ui.muteBtn) ui.muteBtn.textContent = "Mute";
    return;
  }

  if (ui.soundBtn) ui.soundBtn.textContent = "Sound Failed";
  tryManualAudioUnlock();
}

function setupVideoEvents() {
  if (ui.muteBtn) ui.muteBtn.addEventListener("click", toggleVideoMute);
  if (ui.soundBtn) ui.soundBtn.addEventListener("click", toggleVideoSound);
}

async function restoreSession() {
  const token = getToken();
  if (!token) {
    showAuthView();
    return;
  }

  try {
    const profileData = await apiRequest("/user/profile", { token });
    updateProfileUi(profileData?.user || null);
    showDashboardView();
  } catch {
    clearToken();
    showAuthView();
  }
}

async function initPage() {
  cacheElements();
  setAuthMode("login");
  setupAuthEvents();
  setupMobileMenu();
  initializeVideoState();
  setupVideoEvents();
  await restoreSession();
}

window.addEventListener("DOMContentLoaded", () => {
  initPage().catch((error) => {
    console.error("Initialization error:", error);
    showAuthView();
  });
});
