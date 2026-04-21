export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const TOKEN_KEY = "changeaipay_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || "";
}

export function setToken(token) {
  if (!token) return clearToken();
  localStorage.setItem(TOKEN_KEY, token);
  // Back-compat with earlier builds
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
}

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

export async function login({ email, password }) {
  console.log("[API] Calling login with email:", email);
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: { email, password }
  });
  console.log("[API] Login response:", result);
  return result;
}

export async function register({ name, email, password }) {
  console.log("[API] Calling register with name:", name, "email:", email);
  const result = await apiRequest("/auth/register", {
    method: "POST",
    body: { name, email, password }
  });
  console.log("[API] Register response:", result);
  return result;
}

export async function getUserProfile(token) {
  return apiRequest("/user/profile", { token });
}

export async function sendTransaction(token, { recipient, amount }) {
  return apiRequest("/transaction/send", {
    method: "POST",
    token,
    body: { recipient, amount }
  });
}

export async function joinWaitlist(email) {
  console.log("[API] Calling joinWaitlist with email:", email);
  const result = await apiRequest("/waitlist", {
    method: "POST",
    body: { email }
  });
  console.log("[API] Waitlist response:", result);
  return result;
}

export async function getTransactionHistory(token, { limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  return apiRequest(`/transaction/history?${qs.toString()}`, { token });
}

