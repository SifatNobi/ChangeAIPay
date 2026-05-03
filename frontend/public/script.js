const API_BASE_URL =
  (window.CHANGEAIPAY_API_BASE_URL || "https://changeaipay.onrender.com/api").replace(/\/+$/, "");
const TOKEN_KEY = "changeaipay_token";
const VIDEO_VOLUME = 1;
const ROUTES = new Set(["dashboard", "send", "receive", "history"]);

const ui = {};
let WALLET_CACHE = null;
let qrScanner = null;
let lastQR = "";
let lastScanTime = 0;

window.APP_STATE = {
  wallet: null,
  user: null,
  scannerActive: false,
  lastScan: null
};

const appState = {
  token: "",
  authMode: "login",
  user: null,
  balanceNano: "0",
  transactions: [],
  currentRoute: "dashboard",
  qrRequestId: 0,
  scanner: null,
  pollTimer: null,
  pollStartedAt: 0,
  pollTxId: "",
  pollTxHash: "",
  unauthorizedHandled: false
};

function byId(id) {
  return document.getElementById(id);
}

function loadState() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const wallet = localStorage.getItem("walletAddress");
    if (user) window.APP_STATE.user = user;
    if (wallet) window.APP_STATE.wallet = wallet;
    if (window.APP_STATE.wallet) WALLET_CACHE = window.APP_STATE.wallet;
  } catch {}
}

function saveState(user) {
  if (!user) return;
  window.APP_STATE.user = user;
  window.APP_STATE.wallet = user.walletAddress || null;
  if (window.APP_STATE.wallet) {
    localStorage.setItem("walletAddress", window.APP_STATE.wallet);
  }
  localStorage.setItem("user", JSON.stringify(user));
}

document.addEventListener("DOMContentLoaded", loadState);

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
  ui.balanceAmount = byId("balance-amount");
  ui.transactionCount = byId("transaction-count");
  ui.transactionList = byId("transaction-list");

  ui.dashboardContent = byId("dashboard-content");
  ui.sendContent = byId("send-content");
  ui.receiveSection = byId("receive-section");
  ui.historySection = byId("history-section");
  ui.receiveAmountInput = byId("receive-amount");
  ui.qrContainer = byId("qr-container");

  ui.sendForm = byId("send-form");
  ui.sendRecipientInput = byId("send-recipient");
  ui.sendAmountInput = byId("send-amount");
  ui.sendStatus = byId("send-status");
  ui.sendSubmit = byId("send-submit");
  ui.scanQrBtn = byId("scan-qr-btn");
  ui.stopScannerBtn = byId("stop-scanner-btn");
  ui.scanError = byId("scan-error");
  ui.qrScannerContainer = byId("qr-scanner-container");

  ui.logoutBtn = byId("logout-btn");
  ui.mobileLogoutBtn = byId("mobile-logout-btn");
  ui.hamburgerBtn = byId("hamburger-btn");
  ui.mobileMenu = byId("mobile-menu");
  ui.routeLinks = Array.from(document.querySelectorAll("[data-route]"));

  ui.demoVideo = byId("demo-video");
  ui.muteBtn = byId("mute-btn");
  ui.soundBtn = byId("sound-btn");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(6).replace(/\.?0+$/, "") : "0";
}

function formatDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function buildNanoUri(address, amount) {
  const safeAddress = String(address || "").trim();
  const safeAmount = String(amount || "").trim();
  if (!safeAddress) return "";
  return safeAmount
    ? `nano:${safeAddress}?amount=${encodeURIComponent(safeAmount)}`
    : `nano:${safeAddress}`;
}

function getToken() {
  return (localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || "").trim();
}

function setToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    clearToken();
    return;
  }
  localStorage.setItem(TOKEN_KEY, normalizedToken);
  localStorage.setItem("token", normalizedToken);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
}

function parseJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isExpiredToken(token) {
  const payload = parseJwtPayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== "number") return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + 5;
}

function setAuthError(message) {
  if (!ui.authError) return;
  const value = String(message || "").trim();
  ui.authError.textContent = value;
  ui.authError.style.display = value ? "block" : "none";
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
    (appState.authMode === "register" ? "Create account" : "Login");
}

function setWaitlistStatus(message, isError = false) {
  if (!ui.waitlistStatus) return;
  const value = String(message || "").trim();
  ui.waitlistStatus.textContent = value;
  ui.waitlistStatus.style.display = value ? "block" : "none";
  ui.waitlistStatus.classList.toggle("error", Boolean(value && isError));
}

function setSendStatus(type, message, txHash = "") {
  if (!ui.sendStatus) return;
  const kind = String(type || "pending");
  const text = String(message || "").trim();
  const hash = String(txHash || "").trim();

  if (!text && !hash) {
    ui.sendStatus.style.display = "none";
    ui.sendStatus.className = "status";
    ui.sendStatus.innerHTML = "";
    return;
  }

  const safeText = escapeHtml(text);
  const safeHash = escapeHtml(hash);
  const title =
    kind === "success" ? "Payment Success" :
    kind === "error" ? "Payment Failed" :
    kind === "pending" ? "Processing" :
    "Status";

  ui.sendStatus.className = `status ${kind === "action_required" ? "error" : kind}`;
  ui.sendStatus.style.display = "block";
  ui.sendStatus.innerHTML = hash
    ? `<strong>${title}</strong><p>${safeText}</p><p class="tx-hash">Hash: ${safeHash}</p>`
    : `<strong>${title}</strong><p>${safeText}</p>`;
}

function setScanError(message) {
  if (!ui.scanError) return;
  const value = String(message || "").trim();
  ui.scanError.textContent = value;
  ui.scanError.style.display = value ? "block" : "none";
}

function setSendLoading(isLoading) {
  if (ui.sendSubmit) {
    ui.sendSubmit.disabled = isLoading;
    ui.sendSubmit.textContent = isLoading ? "Sending..." : "Send";
  }
  if (ui.sendRecipientInput) ui.sendRecipientInput.disabled = isLoading;
  if (ui.sendAmountInput) ui.sendAmountInput.disabled = isLoading;
  if (ui.scanQrBtn) ui.scanQrBtn.disabled = isLoading;
}

function setAuthMode(mode) {
  appState.authMode = mode === "register" ? "register" : "login";
  const isRegister = appState.authMode === "register";

  if (ui.registerFields) {
    ui.registerFields.style.display = isRegister ? "block" : "none";
  }
  if (ui.nameInput) {
    ui.nameInput.required = isRegister;
    if (!isRegister) ui.nameInput.value = "";
  }
  if (ui.authTitle) ui.authTitle.textContent = isRegister ? "Register" : "Login";
  if (ui.authSubmit) {
    ui.authSubmit.textContent = isRegister ? "Create account" : "Login";
    ui.authSubmit.dataset.defaultText = ui.authSubmit.textContent;
  }
  if (ui.switchAuth) {
    ui.switchAuth.textContent = isRegister
      ? "Already have an account? Login"
      : "Need an account? Register";
  }
  setAuthError("");
}

function showAuthView() {
  if (ui.authSection) ui.authSection.style.display = "";
  if (ui.dashboardSection) ui.dashboardSection.style.display = "none";
  closeMobileMenu();
  stopScanner().catch(() => {});
  stopPolling();
}

function showDashboardView() {
  if (ui.authSection) ui.authSection.style.display = "none";
  if (ui.dashboardSection) ui.dashboardSection.style.display = "";
}

function closeMobileMenu() {
  if (ui.mobileMenu) ui.mobileMenu.style.display = "none";
  if (ui.hamburgerBtn) ui.hamburgerBtn.classList.remove("active");
}

function handleUnauthorized(message = "Session expired. Please login again.") {
  if (appState.unauthorizedHandled) return;
  appState.unauthorizedHandled = true;

  clearToken();
  localStorage.removeItem("user");
  localStorage.removeItem("walletAddress");
  WALLET_CACHE = null;
  window.APP_STATE.wallet = null;
  window.APP_STATE.user = null;
  window.APP_STATE.lastScan = null;
  window.APP_STATE.scannerActive = false;
  appState.token = "";
  appState.user = null;
  window.currentUser = null;
  appState.balanceNano = "0";
  appState.transactions = [];
  renderTransactions([]);
  updateProfileUi(null);
  updateBalanceUi("0");
  showAuthView();
  setAuthError(message);

  setTimeout(() => {
    appState.unauthorizedHandled = false;
  }, 0);
}

async function apiRequest(path, { method = "GET", token = "", body, timeoutMs = 15000 } = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const requestToken = String(token || "").trim();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {})
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
      ...(controller ? { signal: controller.signal } : {})
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(data?.error || data?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      if (response.status === 401 && requestToken) {
        handleUnauthorized();
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Request timed out");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function updateProfileUi(user) {
  appState.user = user || appState.user || null;
  window.currentUser = appState.user || null;
  if (appState.user) {
    saveState(appState.user);
    if (appState.user.walletAddress) {
      WALLET_CACHE = String(appState.user.walletAddress).trim();
      window.APP_STATE.wallet = WALLET_CACHE;
    }
  }
  const name = appState.user?.name || "ChangeAIPay User";
  const address = appState.user?.walletAddress || "Wallet not available";
  const displayAddress = appState.user?.walletAddress ? formatAddress(appState.user.walletAddress) : address;

  if (ui.merchantName) ui.merchantName.textContent = name;
  if (ui.walletAddress) ui.walletAddress.textContent = displayAddress;
  if (ui.receiveWalletAddress) ui.receiveWalletAddress.textContent = displayAddress;
  renderQr();
}

function updateBalanceUi(balanceNano) {
  appState.balanceNano = String(balanceNano ?? appState.balanceNano ?? "0");
  if (ui.balanceAmount) ui.balanceAmount.textContent = `${formatAmount(appState.balanceNano)} XNO`;
}

function renderTransactions(items) {
  const list = Array.isArray(items) ? items : [];
  appState.transactions = list;

  if (ui.transactionCount) {
    ui.transactionCount.textContent = `${list.length} ${list.length === 1 ? "entry" : "entries"}`;
  }

  if (!ui.transactionList) return;
  if (list.length === 0) {
    ui.transactionList.innerHTML = '<div class="empty-state">No transactions yet - your payments will appear here.</div>';
    return;
  }

  const rows = list.map((tx) => {
    const direction = tx?.direction === "incoming" ? "incoming" : "outgoing";
    const symbol = direction === "incoming" ? "+" : "-";
    const amount = `${symbol}${formatAmount(tx?.amountNano)} XNO`;
    const counterparty = tx?.counterpart?.email || tx?.counterpart?.walletAddress || "Unknown";
    const timestamp = formatDate(tx?.timestamp);
    const state = String(tx?.status || "pending").toUpperCase();
    return `
      <article class="transaction-card ${direction}">
        <div class="tx-icon">${direction === "incoming" ? "IN" : "OUT"}</div>
        <div class="tx-main">
          <p class="tx-amount">${escapeHtml(amount)}</p>
          <p class="tx-meta">${escapeHtml(counterparty)} ${timestamp ? `- ${escapeHtml(timestamp)}` : ""}</p>
        </div>
        <span class="tx-state">${escapeHtml(state)}</span>
      </article>
    `;
  });

  ui.transactionList.innerHTML = rows.join("");
}

function renderEmptyQr(message) {
  if (!ui.qrContainer) return;
  ui.qrContainer.innerHTML = `<div class="empty-qr"><p class="muted">${escapeHtml(message)}</p></div>`;
}

function formatAddress(addr) {
  const safe = String(addr || "").trim();
  if (safe.length < 18) return safe;
  return `${safe.slice(0, 10)}...${safe.slice(-6)}`;
}

function getWalletAddress() {
  if (window.APP_STATE.wallet) return window.APP_STATE.wallet;

  if (window.APP_STATE.user?.walletAddress) {
    window.APP_STATE.wallet = window.APP_STATE.user.walletAddress;
    WALLET_CACHE = window.APP_STATE.wallet;
    return window.APP_STATE.wallet;
  }

  const stored = localStorage.getItem("walletAddress");
  if (stored) {
    window.APP_STATE.wallet = stored;
    WALLET_CACHE = stored;
    return stored;
  }

  console.error("❌ WALLET HARD FAIL");
  return null;
}

function isValidNanoAddress(addr) {
  if (!addr) return false;
  return /^(nano|xrb)_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/.test(addr);
}

function sanitizeInput(str) {
  return String(str || "").replace(/[^\w.:?=&-]/g, "").trim();
}

function ensureQRCodeLib(callback) {
  if (window.QRCode) {
    callback();
    return;
  }

  const existing = document.querySelector('script[data-qrcode-lib="qrcodejs"]');
  if (existing) {
    existing.addEventListener("load", callback, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/qrcodejs/qrcode.min.js";
  script.setAttribute("data-qrcode-lib", "qrcodejs");
  script.onload = callback;
  script.onerror = () => {
    console.error("Failed to load QRCode library");
  };
  document.head.appendChild(script);
}

function renderNanoQR() {
  const container = document.getElementById("qr-container");
  if (!container) return;

  ensureQRCodeLib(() => {
    const address = getWalletAddress();
    console.log("Wallet used for QR:", address);

    if (!address) {
      container.innerHTML = `
        <div class="empty-qr">
          <p class="muted">Wallet not available</p>
        </div>
      `;
      return;
    }

    const amountInput = document.getElementById("receive-amount");
    const amount = amountInput?.value?.trim();
    const rawAmount = amount ? parseFloat(amount) : null;
    const raw = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 1e30) : null;
    const uri = raw ? `nano:${address}?amount=${raw}` : `nano:${address}`;

    container.innerHTML = "";

    if (!window.QRCode) {
      console.error("QRCode lib missing");
      return;
    }

    try {
      new window.QRCode(container, {
        text: uri,
        width: 200,
        height: 200
      });
    } catch (err) {
      console.error("QR generator unavailable.", err);
      container.innerHTML = `
        <div class="empty-qr">
          <p class="muted">QR failed to load</p>
        </div>
      `;
    }
  });
}

function renderQr() {
  renderNanoQR();
}

function triggerScanFeedback() {
  if (navigator.vibrate) navigator.vibrate(100);
  document.body.style.transition = "0.1s";
  document.body.style.opacity = "0.6";
  setTimeout(() => {
    document.body.style.opacity = "1";
  }, 100);
}

function parseNanoURI(text) {
  try {
    if (!text) return null;
    let clean = sanitizeInput(text);

    if (!clean.startsWith("nano:") && !clean.startsWith("xrb:")) {
      console.warn("Blocked non-nano QR");
      return null;
    }

    clean = clean.replace("nano:", "").replace("xrb:", "");

    const [address, query] = clean.split("?");
    if (!isValidNanoAddress(address)) {
      console.warn("Invalid address blocked:", address);
      return null;
    }
    let amount = "";

    if (query) {
      const params = new URLSearchParams(query);
      amount = params.get("amount") || "";
    }

    return {
      address,
      amount
    };
  } catch (e) {
    console.error("Secure parse failed:", e);
    return null;
  }
}

async function safeFetch(path, options = {}, retries = 2) {
  const method = options.method || "GET";
  const token = options.token || "";
  const body = options.body;
  const timeoutMs = options.timeoutMs || 5000;

  try {
    return await apiRequest(path, { method, token, body, timeoutMs });
  } catch (err) {
    if (retries > 0) {
      console.warn("Retrying:", path);
      return safeFetch(path, options, retries - 1);
    }
    throw err;
  }
}

async function confirmAutofill(data) {
  const preview = `${data.address.slice(0, 10)}...${data.address.slice(-6)}`;
  return confirm(`Send to:\n${preview}\n\nProceed?`);
}

function waitForElement(id, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout: ${id}`));
      }
      requestAnimationFrame(check);
    }
    check();
  });
}

function goToSendPage() {
  return new Promise((resolve) => {
    window.location.hash = "#send";
    renderRoute("send", { scroll: false });
    setTimeout(resolve, 400);
  });
}

async function autofillFromQR(data) {
  if (!data || !isValidNanoAddress(data.address)) {
    console.warn("Blocked autofill");
    return;
  }

  const approved = await confirmAutofill(data);
  if (!approved) return;

  try {
    await goToSendPage();
    const recipient = await waitForElement("send-recipient");
    const amount = await waitForElement("send-amount");

    recipient.value = data.address;
    recipient.dispatchEvent(new Event("input", { bubbles: true }));

    if (data.amount) {
      amount.value = data.amount;
      amount.dispatchEvent(new Event("input", { bubbles: true }));
    }

    console.log("Secure autofill applied");
  } catch (err) {
    console.error("Autofill failed:", err);
  }
}

function canScan() {
  const now = Date.now();
  if (now - lastScanTime < 2000) return false;
  lastScanTime = now;
  return true;
}

async function onScanSuccess(decodedText) {
  if (!decodedText) return;

  const normalized = String(decodedText).trim();
  if (!canScan()) return;

  if (!normalized.startsWith("nano:") && !normalized.startsWith("xrb:")) {
    console.warn("Blocked malicious QR");
    return;
  }

  if (window.APP_STATE.lastScan === normalized) return;
  window.APP_STATE.lastScan = normalized;
  triggerScanFeedback();

  const parsed = parseNanoURI(normalized);

  if (!parsed || !parsed.address) {
    console.error("❌ INVALID QR");
    return;
  }

  await autofillFromQR(parsed);
  stopScanner();
}

function startScanner() {
  if (window.APP_STATE.scannerActive || !ui.qrScannerContainer) return;
  if (typeof window.Html5Qrcode !== "function") {
    setScanError("QR scanner library is unavailable.");
    return;
  }

  setScanError("");
  ui.qrScannerContainer.style.display = "block";

  window.Html5Qrcode.getCameras()
    .then((devices) => {
      let cameraId = devices?.[0]?.id;
      const backCam = devices?.find((d) => String(d?.label || "").toLowerCase().includes("back"));
      if (backCam) cameraId = backCam.id;

      qrScanner = new window.Html5Qrcode("qr-scanner");
      window.html5QrCode = qrScanner;
      appState.scanner = qrScanner;

      return qrScanner.start(
        cameraId || { facingMode: "environment" },
        { fps: 12, qrbox: 250 },
        onScanSuccess,
        () => {}
      );
    })
    .then(() => {
      window.APP_STATE.scannerActive = true;
    })
    .catch((error) => {
      setScanError(String(error?.message || "Could not start QR scanner."));
      stopScanner();
    });
}

function openScanner() {
  startScanner();
}

function stopScanner() {
  const scanner = qrScanner || appState.scanner || window.html5QrCode;
  if (!scanner) {
    window.APP_STATE.scannerActive = false;
    if (ui.qrScannerContainer) ui.qrScannerContainer.style.display = "none";
    return Promise.resolve();
  }

  return scanner.stop()
    .then(() => scanner.clear())
    .catch(() => {})
    .finally(() => {
      qrScanner = null;
      appState.scanner = null;
      window.html5QrCode = null;
      window.APP_STATE.scannerActive = false;
      if (ui.qrScannerContainer) ui.qrScannerContainer.style.display = "none";
    });
}

function stopPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
    appState.pollTimer = null;
  }
  appState.pollStartedAt = 0;
  appState.pollTxId = "";
  appState.pollTxHash = "";
}

async function pollTransactionStatus() {
  if (!appState.pollTxId || !appState.token) {
    stopPolling();
    return;
  }

  const elapsedSec = Math.floor((Date.now() - appState.pollStartedAt) / 1000);
  if (elapsedSec > 120) {
    setSendStatus("pending", "Payment submitted. Confirmation is taking longer than usual.", appState.pollTxHash);
    stopPolling();
    return;
  }

  try {
    const result = await apiRequest(`/transaction/${appState.pollTxId}/status`, {
      token: appState.token,
      timeoutMs: 10000
    });

    if (!result?.success) return;

    if (result.confirmed) {
      setSendStatus("success", `Payment confirmed in ${elapsedSec}s.`, result.tx_hash || appState.pollTxHash);
      stopPolling();
      void loadHistory(appState.token);
      void loadProfile(appState.token);
      return;
    }

    if (result.status === "failed") {
      setSendStatus("error", result.message || "Payment failed.");
      stopPolling();
      return;
    }

    setSendStatus("pending", `Confirming on network (${elapsedSec}s)...`, result.tx_hash || appState.pollTxHash);
  } catch (error) {
    if (error?.status === 401) {
      stopPolling();
      return;
    }
  }
}

function startPolling(transactionId, txHash) {
  stopPolling();
  appState.pollTxId = String(transactionId || "");
  appState.pollTxHash = String(txHash || "");
  if (!appState.pollTxId) return;
  appState.pollStartedAt = Date.now();
  void pollTransactionStatus();
  appState.pollTimer = setInterval(() => {
    void pollTransactionStatus();
  }, 2500);
}

function getRouteFromHash() {
  const route = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
  return ROUTES.has(route) ? route : "dashboard";
}

function updateActiveNav(route) {
  if (!ui.routeLinks?.length) return;
  ui.routeLinks.forEach((link) => {
    const linkRoute = String(link.getAttribute("data-route") || "").toLowerCase();
    const active = route === linkRoute;
    link.classList.toggle("active", active);
  });
}

function renderRoute(route, { scroll = true } = {}) {
  appState.currentRoute = ROUTES.has(route) ? route : "dashboard";
  const isSend = appState.currentRoute === "send";

  if (ui.dashboardContent) ui.dashboardContent.style.display = isSend ? "none" : "";
  if (ui.sendContent) ui.sendContent.style.display = isSend ? "" : "none";
  updateActiveNav(appState.currentRoute);

  if (appState.currentRoute === "receive") {
    renderQr();
  }
  if (appState.currentRoute === "history") {
    renderTransactions(appState.transactions);
  }

  if (!scroll) return;

  if (appState.currentRoute === "receive" && ui.receiveSection) {
    setTimeout(() => {
      ui.receiveSection.scrollIntoView({ behavior: "smooth", block: "start" });
      ui.receiveAmountInput?.focus();
    }, 40);
  } else if (appState.currentRoute === "history" && ui.historySection) {
    setTimeout(() => {
      ui.historySection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  } else if (appState.currentRoute === "dashboard" && ui.dashboardContent) {
    setTimeout(() => {
      ui.dashboardContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  } else if (appState.currentRoute === "send" && ui.sendContent) {
    setTimeout(() => {
      ui.sendContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }
}

function setupRoutes() {
  if (ui.routeLinks?.length) {
    ui.routeLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const route = String(link.getAttribute("data-route") || "").toLowerCase();
        if (ROUTES.has(route)) {
          window.location.hash = route;
          renderRoute(route, { scroll: true });
        }
        closeMobileMenu();
      });
    });
  }

  window.addEventListener("hashchange", () => {
    renderRoute(getRouteFromHash(), { scroll: true });
    if (window.location.hash !== "#send") {
      stopScanner();
    }
  });

  renderRoute(getRouteFromHash(), { scroll: false });
}

async function loadProfile(token, { silent = true } = {}) {
  try {
    const result = await safeFetch("/user/profile", { token, timeoutMs: 5000 }, 2);
    if (result?.user) updateProfileUi(result.user);
    if (result?.balance?.balanceNano !== undefined) updateBalanceUi(result.balance.balanceNano);
  } catch (error) {
    const cachedWallet = localStorage.getItem("walletAddress");
    if (cachedWallet) {
      updateProfileUi({
        ...(window.APP_STATE.user || {}),
        walletAddress: cachedWallet
      });
      return;
    }
    if (!silent && error?.status !== 401) {
      console.warn("Profile refresh failed:", error?.message || error);
    }
  }
}

async function loadHistory(token, { silent = true } = {}) {
  try {
    const result = await safeFetch("/transaction/history?limit=15", { token, timeoutMs: 5000 }, 2);
    renderTransactions(result?.transactions || []);
  } catch (error) {
    if (!silent && error?.status !== 401) {
      console.warn("History refresh failed:", error?.message || error);
    }
  }
}

function loadDashboardData(token) {
  if (!token) return;
  void loadProfile(token, { silent: false });
  void loadHistory(token, { silent: false });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!ui.authForm) return;

  const name = String(ui.nameInput?.value || "").trim();
  const email = String(ui.emailInput?.value || "").trim().toLowerCase();
  const password = String(ui.passwordInput?.value || "");

  if (!email || !password) {
    setAuthError("Email and password are required.");
    return;
  }
  if (appState.authMode === "register" && !name) {
    setAuthError("Name is required.");
    return;
  }

  setAuthError("");
  setAuthLoading(true);

  try {
    const endpoint = appState.authMode === "register" ? "/auth/register" : "/auth/login";
    const payload =
      appState.authMode === "register" ? { name, email, password } : { email, password };

    const authData = await apiRequest(endpoint, {
      method: "POST",
      body: payload,
      timeoutMs: 15000
    });

    const token = String(authData?.token || "");
    if (!token) throw new Error("Login succeeded but no token was returned.");

    appState.token = token;
    setToken(token);
    WALLET_CACHE = authData?.user?.walletAddress || null;
    window.currentUser = authData?.user || null;
    window.APP_STATE.user = authData?.user || null;
    window.APP_STATE.wallet = WALLET_CACHE;
    saveState(authData?.user || null);
    updateProfileUi(authData?.user || null);
    setTimeout(() => {
      renderNanoQR();
    }, 200);
    updateBalanceUi("0");
    showDashboardView();
    renderRoute(getRouteFromHash(), { scroll: false });
    ui.authForm.reset();
    setAuthMode("login");
    setSendStatus("", "");

    // Keep login fast: load full profile/history in the background.
    loadDashboardData(token);
  } catch (error) {
    setAuthError(error?.message || "Authentication failed.");
  } finally {
    setAuthLoading(false);
  }
}

async function handleWaitlistSubmit(event) {
  event.preventDefault();
  const email = String(ui.waitlistEmail?.value || "").trim().toLowerCase();
  if (!email) {
    setWaitlistStatus("Email is required.", true);
    return;
  }

  setWaitlistStatus("");
  try {
    await apiRequest("/waitlist", {
      method: "POST",
      body: { email },
      timeoutMs: 10000
    });
    setWaitlistStatus("You are on the waitlist.");
    ui.waitlistForm?.reset();
  } catch (error) {
    setWaitlistStatus(error?.message || "Failed to join waitlist.", true);
  }
}

function handleLogout() {
  clearToken();
  localStorage.removeItem("user");
  localStorage.removeItem("walletAddress");
  WALLET_CACHE = null;
  window.APP_STATE.user = null;
  window.APP_STATE.wallet = null;
  window.APP_STATE.lastScan = null;
  window.APP_STATE.scannerActive = false;
  appState.token = "";
  appState.user = null;
  window.currentUser = null;
  appState.balanceNano = "0";
  renderTransactions([]);
  updateProfileUi(null);
  updateBalanceUi("0");
  showAuthView();
}

async function handleSendSubmit(event) {
  event.preventDefault();
  if (!appState.token) {
    handleUnauthorized();
    return;
  }

  const recipient = String(ui.sendRecipientInput?.value || "").trim();
  const amount = String(ui.sendAmountInput?.value || "").trim();
  if (!recipient || !amount) {
    setSendStatus("error", "Recipient and amount are required.");
    return;
  }

  setSendLoading(true);
  setSendStatus("pending", "Submitting payment...");

  try {
    const result = await apiRequest("/transaction/send", {
      method: "POST",
      token: appState.token,
      body: { recipient, amount },
      timeoutMs: 20000
    });

    const txHash = result?.tx_hash || "";
    const txId = result?.transaction?.id || result?.transaction_id || "";

    if (txHash) {
      setSendStatus("pending", "Payment submitted. Confirming...", txHash);
      if (ui.sendForm) ui.sendForm.reset();
      if (txId) {
        startPolling(txId, txHash);
      } else {
        void loadHistory(appState.token);
      }
      return;
    }

    if (result?.success) {
      setSendStatus("success", result?.message || "Payment completed.");
      if (ui.sendForm) ui.sendForm.reset();
      void loadHistory(appState.token);
      return;
    }

    setSendStatus("error", result?.error || result?.message || "Payment failed.");
  } catch (error) {
    const message = String(error?.message || "Payment failed.");
    const needsFunding = /fund|receive|activate|wallet/i.test(message);
    setSendStatus(needsFunding ? "action_required" : "error", message);
  } finally {
    setSendLoading(false);
  }
}

function setupAuthEvents() {
  if (ui.authForm) ui.authForm.addEventListener("submit", handleAuthSubmit);
  if (ui.waitlistForm) ui.waitlistForm.addEventListener("submit", handleWaitlistSubmit);
  if (ui.switchAuth) {
    ui.switchAuth.addEventListener("click", (event) => {
      event.preventDefault();
      setAuthMode(appState.authMode === "register" ? "login" : "register");
    });
  }
  if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", handleLogout);
  if (ui.mobileLogoutBtn) ui.mobileLogoutBtn.addEventListener("click", handleLogout);
}

function setupDashboardEvents() {
  if (ui.receiveAmountInput) {
    ui.receiveAmountInput.addEventListener("input", () => {
      renderNanoQR();
    });
  }
  if (ui.sendRecipientInput) {
    ui.sendRecipientInput.setAttribute("autocomplete", "off");
    ui.sendRecipientInput.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";

      if (!text.includes("nano_") && !text.includes("xrb_")) {
        e.preventDefault();
        alert("Only Nano addresses allowed");
        return;
      }

      const parsed = parseNanoURI(text.startsWith("nano:") || text.startsWith("xrb:") ? text : `nano:${text}`);
      if (!parsed) {
        e.preventDefault();
        alert("Invalid address blocked");
      }
    });
  }
  if (ui.sendAmountInput) {
    ui.sendAmountInput.setAttribute("autocomplete", "off");
  }
  if (ui.sendForm) ui.sendForm.addEventListener("submit", handleSendSubmit);
  if (ui.scanQrBtn) ui.scanQrBtn.addEventListener("click", () => {
    void openScanner();
  });
  if (ui.stopScannerBtn) ui.stopScannerBtn.addEventListener("click", () => {
    void stopScanner();
  });
  if (ui.qrContainer) {
    ui.qrContainer.addEventListener("click", () => {
      const address = getWalletAddress();
      if (!address) return;
      const amount = document.getElementById("receive-amount")?.value;
      const parsed = amount ? parseFloat(amount) : null;
      const raw = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1e30) : null;
      const link = raw ? `nano:${address}?amount=${raw}` : `nano:${address}`;
      window.location.href = link;
    });
  }
  if (ui.receiveWalletAddress) {
    ui.receiveWalletAddress.addEventListener("click", () => {
      const addr = getWalletAddress();
      if (!addr || !navigator.clipboard?.writeText) return;
      navigator.clipboard.writeText(addr).then(() => {
        console.log("📋 Address copied");
      }).catch(() => {});
    });
  }
}

function smartRenderQR() {
  const addr = getWalletAddress() || "";
  const amt = document.getElementById("receive-amount")?.value || "";
  const current = `${addr}|${amt}`;
  if (current === lastQR) return;
  lastQR = current;
  renderNanoQR();
}

function setupMobileMenu() {
  if (!ui.hamburgerBtn || !ui.mobileMenu) return;
  ui.hamburgerBtn.addEventListener("click", () => {
    const open = ui.mobileMenu.style.display === "flex";
    ui.mobileMenu.style.display = open ? "none" : "flex";
    ui.hamburgerBtn.classList.toggle("active", !open);
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
    if (context.state === "suspended") context.resume().catch(() => {});
  } catch (error) {
    console.warn("Web Audio manual unlock failed:", error);
  }
}

function syncVideoButtonState() {
  if (!ui.demoVideo) return;
  if (ui.muteBtn) ui.muteBtn.textContent = ui.demoVideo.muted ? "Unmute" : "Mute";
  if (ui.soundBtn && !ui.demoVideo.muted) ui.soundBtn.textContent = "Sound On";
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
  if (!ui.demoVideo.muted) await unlockVideoAudio();
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

function restoreSession() {
  loadState();
  WALLET_CACHE = window.APP_STATE.wallet || WALLET_CACHE;
  window.currentUser = window.APP_STATE.user || null;
  appState.user = window.APP_STATE.user || null;

  const token = getToken();
  if (!token || isExpiredToken(token)) {
    clearToken();
    showAuthView();
    return;
  }

  appState.token = token;
  showDashboardView();
  renderRoute(getRouteFromHash(), { scroll: false });
  loadDashboardData(token);
}

function initPage() {
  cacheElements();
  document.querySelectorAll("input").forEach((input) => {
    if (input.id === "send-recipient" || input.id === "send-amount") {
      input.setAttribute("autocomplete", "off");
    }
  });
  setAuthMode("login");
  setupAuthEvents();
  setupDashboardEvents();
  setupMobileMenu();
  setupRoutes();
  initializeVideoState();
  setupVideoEvents();
  renderTransactions([]);
  renderQr();
  restoreSession();
}

window.addEventListener("DOMContentLoaded", () => {
  try {
    loadState();
    WALLET_CACHE = window.APP_STATE.wallet || WALLET_CACHE;
    window.currentUser = window.APP_STATE.user || null;
    initPage();
    setTimeout(renderNanoQR, 300);
  } catch (error) {
    console.error("Initialization error:", error);
    showAuthView();
  }
});

window.addEventListener("load", () => {
  setTimeout(() => {
    const wallet = getWalletAddress();
    console.log("Wallet used for QR:", wallet);
    renderNanoQR();
  }, 600);
});

window.addEventListener("error", (e) => {
  if (String(e?.message || "").toLowerCase().includes("camera")) {
    console.warn("Camera error -> fallback active");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopScanner();
  }
});

setInterval(smartRenderQR, 500);
