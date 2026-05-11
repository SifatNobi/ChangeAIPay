export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://changeaipay.onrender.com/api";

const TOKEN_KEY = "changeaipay_token";

export function getToken() {
  return (localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || "").trim();
}

export function setToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return clearToken();
  localStorage.setItem(TOKEN_KEY, normalizedToken);
  localStorage.setItem("token", normalizedToken);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
}

async function apiRequest(path, { method = "GET", token, body } = {}) {
  const requestToken = String(token || "").trim();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {})
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || "Request failed");
    error.details = data?.details || null;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function login({ email, password }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

export async function register({ name, email, password }) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: { name, email, password }
  });
}

export async function getUserProfile(token) {
  return apiRequest("/user/profile", { token });
}

export async function sendTransaction(token, payload) {
  return apiRequest("/transaction/send", {
    method: "POST",
    token,
    body: payload
  });
}

export async function joinWaitlist(email) {
  return apiRequest("/waitlist", {
    method: "POST",
    body: { email }
  });
}

export async function getTransactionHistory(token, { limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  return apiRequest(`/transaction/history?${qs.toString()}`, { token });
}
