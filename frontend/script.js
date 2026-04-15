const API_BASE = ""; // same-origin (backend serves frontend)

const views = {
  home: document.getElementById("view-home"),
  login: document.getElementById("view-login"),
  register: document.getElementById("view-register"),
  dashboard: document.getElementById("view-dashboard")
};

const logoutBtn = document.getElementById("logoutBtn");
const navLinks = Array.from(document.querySelectorAll("[data-route]"));

const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const loginSubmit = document.getElementById("loginSubmit");

const registerForm = document.getElementById("registerForm");
const registerFeedback = document.getElementById("registerFeedback");
const registerSubmit = document.getElementById("registerSubmit");

const userLine = document.getElementById("userLine");
const walletAddress = document.getElementById("walletAddress");
const walletBalance = document.getElementById("walletBalance");
const walletPending = document.getElementById("walletPending");
const lastUpdated = document.getElementById("lastUpdated");
const dashFeedback = document.getElementById("dashFeedback");
const refreshBtn = document.getElementById("refreshBtn");

const sendForm = document.getElementById("sendForm");
const sendFeedback = document.getElementById("sendFeedback");
const sendSubmit = document.getElementById("sendSubmit");

const txBody = document.getElementById("txBody");
const txLoading = document.getElementById("txLoading");

const buyNanoBtn = document.getElementById("buyNanoBtn");
const buyModal = document.getElementById("buyModal");
const buyWalletAddress = document.getElementById("buyWalletAddress");

let pollTimer = null;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

function setFeedback(el, { type, message }) {
  el.classList.remove("is-error", "is-ok");
  if (!message) {
    el.textContent = "";
    return;
  }
  if (type === "error") el.classList.add("is-error");
  if (type === "ok") el.classList.add("is-ok");
  el.textContent = message;
}

async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const details = data?.details ? ` — ${data.details}` : "";
    const err = new Error(msg + details);
    err.status = res.status;
    throw err;
  }

  return data;
}

function showView(name) {
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("is-active", k === name);
  });

  const hash = `#${name === "home" ? "home" : name}`;
  navLinks.forEach((a) => {
    const current = a.getAttribute("href") === hash;
    if (current) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  const authed = Boolean(getToken());
  logoutBtn.style.display = authed ? "inline-flex" : "none";

  if (name !== "dashboard") stopPolling();
}

function route() {
  const authed = Boolean(getToken());
  const hash = (location.hash || "#home").slice(1);

  if ((hash === "dashboard") && !authed) {
    showView("login");
    return;
  }

  if ((hash === "login" || hash === "register") && authed) {
    location.hash = "#dashboard";
    return;
  }

  if (!views[hash]) {
    showView("home");
    return;
  }
  showView(hash);

  if (hash === "dashboard") {
    void loadDashboard();
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    void refreshAll({ quiet: true });
  }, 10000);
}

function fmtTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch (_e) {
    return String(d || "");
  }
}

function clipHash(h) {
  const s = String(h || "");
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-8)}`;
}

async function loadDashboard() {
  setFeedback(dashFeedback, { message: "" });
  userLine.textContent = "Loading…";
  walletAddress.textContent = "—";
  walletBalance.textContent = "—";
  walletPending.textContent = "—";
  lastUpdated.textContent = "—";

  try {
    const data = await api("/dashboard");
    userLine.textContent = `${data.user.name} • ${data.user.email}`;
    walletAddress.textContent = data.user.walletAddress || "—";
    buyWalletAddress.textContent = data.user.walletAddress || "—";

    if (!data.user.walletAddress) {
      setFeedback(dashFeedback, { type: "error", message: "Wallet missing. Try refreshing or re-login." });
    }

    if (data.balance) {
      walletBalance.textContent = `${data.balance.balanceNano} NANO`;
      walletPending.textContent = `${data.balance.pendingNano} NANO`;
    }

    renderTransactions(data.recentTransactions || []);
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

    startPolling();
  } catch (e) {
    if (e.status === 401) {
      setToken(null);
      location.hash = "#login";
      return;
    }
    setFeedback(dashFeedback, { type: "error", message: e.message });
    userLine.textContent = "—";
  }
}

function renderTransactions(list) {
  txBody.innerHTML = "";
  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = "No transactions yet.";
    tr.appendChild(td);
    txBody.appendChild(tr);
    return;
  }

  for (const t of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtTime(t.timestamp)}</td>
      <td class="mono">${t.amountNano}</td>
      <td class="mono">${t.sender?.email || ""}</td>
      <td class="mono">${t.receiver?.email || ""}</td>
      <td class="mono" title="${t.txHash}">${clipHash(t.txHash)}</td>
    `;
    txBody.appendChild(tr);
  }
}

async function refreshAll({ quiet } = {}) {
  if (!quiet) setFeedback(dashFeedback, { message: "" });
  txLoading.textContent = "Loading…";
  try {
    const [b, tx] = await Promise.all([api("/balance"), api("/transactions?limit=50&page=1")]);
    walletBalance.textContent = `${b.balanceNano} NANO`;
    walletPending.textContent = `${b.pendingNano} NANO`;
    renderTransactions(tx.transactions || []);
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    txLoading.textContent = "—";
  } catch (e) {
    txLoading.textContent = "—";
    if (e.status === 401) {
      setToken(null);
      location.hash = "#login";
      return;
    }
    if (!quiet) setFeedback(dashFeedback, { type: "error", message: e.message });
  }
}

loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  setFeedback(loginFeedback, { message: "" });
  loginSubmit.disabled = true;
  try {
    const fd = new FormData(loginForm);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setFeedback(loginFeedback, { type: "ok", message: "Logged in." });
    location.hash = "#dashboard";
  } catch (e) {
    setFeedback(loginFeedback, { type: "error", message: e.message });
  } finally {
    loginSubmit.disabled = false;
  }
});

registerForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  setFeedback(registerFeedback, { message: "" });
  registerSubmit.disabled = true;
  try {
    const fd = new FormData(registerForm);
    const name = String(fd.get("name") || "");
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const data = await api("/auth/register", { method: "POST", body: { name, email, password } });
    setToken(data.token);
    setFeedback(registerFeedback, { type: "ok", message: "Account created." });
    location.hash = "#dashboard";
  } catch (e) {
    setFeedback(registerFeedback, { type: "error", message: e.message });
  } finally {
    registerSubmit.disabled = false;
  }
});

sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  setFeedback(sendFeedback, { message: "" });
  sendSubmit.disabled = true;
  try {
    const fd = new FormData(sendForm);
    const to = String(fd.get("to") || "").trim();
    const amount = String(fd.get("amount") || "").trim();
    const res = await api("/send-payment", { method: "POST", body: { to, amount } });
    setFeedback(sendFeedback, { type: "ok", message: `Sent. Tx: ${res.txHash}` });
    sendForm.reset();
    await refreshAll({ quiet: true });
  } catch (e) {
    setFeedback(sendFeedback, { type: "error", message: e.message });
  } finally {
    sendSubmit.disabled = false;
  }
});

refreshBtn.addEventListener("click", () => {
  void refreshAll();
});

logoutBtn.addEventListener("click", () => {
  setToken(null);
  stopPolling();
  location.hash = "#home";
});

function openBuyModal() {
  buyModal.classList.add("is-open");
  buyModal.setAttribute("aria-hidden", "false");
}
function closeBuyModal() {
  buyModal.classList.remove("is-open");
  buyModal.setAttribute("aria-hidden", "true");
}

buyNanoBtn.addEventListener("click", () => openBuyModal());
buyModal.addEventListener("click", (e) => {
  const t = e.target;
  if (t && (t.hasAttribute("data-close") || t.closest("[data-close]"))) closeBuyModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeBuyModal();
});

window.addEventListener("hashchange", route);
route();

