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

export async function sendTransaction(token, { recipient, amount }) {
  return apiRequest("/transaction/send", {
    method: "POST",
    token,
    body: { recipient, amount }
  });
}

export async function joinWaitlist({ email, phone }) {
  return apiRequest("/waitlist", {
    method: "POST",
    body: { email, phone }
  });
}

export async function getTransactionHistory(token, { limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  return apiRequest(`/transaction/history?${qs.toString()}`, { token });
}

export async function sendAIChat(token, message, context = {}) {
  return apiRequest("/ai/chat", {
    method: "POST",
    token,
    body: { message, context }
  });
}

export async function getAIHistory(token) {
  return apiRequest("/ai/history", { token });
}

export async function clearAIHistory(token) {
  return apiRequest("/ai/history", {
    method: "DELETE",
    token
  });
}

export async function getAISuggestions(token) {
  return apiRequest("/ai/suggestions", { token });
}

export async function getSubscriptionPlans() {
  return apiRequest("/subscription/plans");
}

export async function getCurrentSubscription(token) {
  return apiRequest("/subscription/current", { token });
}

export async function changeSubscriptionPlan(token, planId) {
  return apiRequest("/subscription/change", {
    method: "POST",
    token,
    body: { planId }
  });
}

export async function getSubscriptionUsage(token) {
  return apiRequest("/subscription/usage", { token });
}

export async function cancelSubscription(token) {
  return apiRequest("/subscription/cancel", {
    method: "POST",
    token
  });
}

export async function getMerchantPlans() {
  return apiRequest("/merchant-subscription/plans");
}

export async function getMerchantSubscription(token) {
  return apiRequest("/merchant-subscription/current", { token });
}

export async function updateMerchantRevenue(token, annualRevenue) {
  return apiRequest("/merchant-subscription/revenue-update", {
    method: "POST",
    token,
    body: { annualRevenue }
  });
}

export async function getMerchantAnalytics(token) {
  return apiRequest("/merchant-subscription/analytics", { token });
}

export async function getCashFlowPrediction(token) {
  return apiRequest("/merchant-subscription/cashflow", { token });
}

export async function getLifetimeValueData(token) {
  return apiRequest("/merchant-subscription/ltv", { token });
}

export async function sendPayment(token, { recipient, amount, note }) {
  return apiRequest("/payments/send", {
    method: "POST",
    token,
    body: { recipient, amount, note }
  });
}

export async function requestPayment(token, { amount, description, expiresIn }) {
  return apiRequest("/payments/request", {
    method: "POST",
    token,
    body: { amount, description, expiresIn }
  });
}

export async function getPaymentHistory(token, { limit, offset, type } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (offset) qs.set("offset", String(offset));
  if (type) qs.set("type", type);
  return apiRequest(`/payments/history?${qs.toString()}`, { token });
}

export async function getTransactionDetails(token, transactionId) {
  return apiRequest(`/payments/${transactionId}`, { token });
}

export async function verifyRecipient(token, address) {
  return apiRequest("/payments/verify-recipient", {
    method: "POST",
    token,
    body: { address }
  });
}

export async function calculateFX(token, { amount, fromCurrency, toCurrency }) {
  return apiRequest("/payments/convert", {
    method: "POST",
    token,
    body: { amount, fromCurrency, toCurrency }
  });
}

export async function getSmartRouting(token, { amount, destination }) {
  return apiRequest("/payments/route", {
    method: "POST",
    token,
    body: { amount, destination }
  });
}

export async function undoPayment(token, transactionId) {
  return apiRequest(`/payments/${transactionId}/undo`, {
    method: "POST",
    token
  });
}

export async function getPaymentTranscript(token, transactionId) {
  return apiRequest(`/payments/${transactionId}/transcript`, { token });
}

export async function getBillingPlans(token, currency = "EUR") {
  return apiRequest(`/billing/plans?currency=${currency}`, { token });
}

export async function createBillingCheckout(token, { planId, currency, paymentMethod }) {
  return apiRequest("/billing/checkout", {
    method: "POST",
    token,
    body: { planId, currency, paymentMethod }
  });
}

export async function processBillingPayment(token, { sessionId, paymentMethod }) {
  return apiRequest("/billing/process", {
    method: "POST",
    token,
    body: { sessionId, paymentMethod }
  });
}

export async function getPaymentMethods(token) {
  return apiRequest("/billing/methods", { token });
}

export async function getBillingHistory(token) {
  return apiRequest("/billing/history", { token });
}

export async function getBillingAnalytics(token) {
  return apiRequest("/billing/analytics", { token });
}

export async function pauseSubscriptionBilling(token, reason) {
  return apiRequest("/billing/pause", {
    method: "POST",
    token,
    body: { reason }
  });
}

export async function resumeSubscriptionBilling(token) {
  return apiRequest("/billing/resume", {
    method: "POST",
    token
  });
}

export async function changePlanWithProration(token, { newPlanId, paymentMethod }) {
  return apiRequest("/billing/change-plan", {
    method: "POST",
    token,
    body: { newPlanId, paymentMethod }
  });
}

export async function getSubscriptionAnalytics(token) {
  return apiRequest("/billing/subscription-analytics", { token });
}

export async function getAIRecommendations(token) {
  return apiRequest("/billing/ai-recommendations", { token });
}

export async function getPlanComparison(token, plans = "edge,prime,apex") {
  return apiRequest(`/billing/plan-comparison?plans=${plans}`, { token });
}

export async function getRenewalReminder(token) {
  return apiRequest("/billing/renewal-reminder", { token });
}
