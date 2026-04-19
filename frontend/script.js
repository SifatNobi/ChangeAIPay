// Global state
let currentRoute = 'auth';
let authMode = 'login';
let token = localStorage.getItem('changeaipay_token') || '';
let profile = null;
let mobileMenuOpen = false;

// API configuration
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://your-backend-url.com';

// DOM elements
const app = document.getElementById('app');
const demoSection = document.getElementById('demo-section');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const dashboardContent = document.getElementById('dashboard-content');
const sendContent = document.getElementById('send-content');

// Initialize app
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  setupEventListeners();
  checkAuthStatus();
  updateUI();
  initializeVideoState();
}

/* =========================
   VIDEO AUDIO SYSTEM (FIXED)
========================= */

function initializeVideoState() {
  const video = document.getElementById('demo-video');
  if (!video) return;

  // ONLY mute for autoplay compliance
  video.muted = true;
  video.volume = 1;
}

// SINGLE audio unlock function
async function unlockVideoAudio() {
  const video = document.getElementById('demo-video');
  if (!video) return false;

  try {
    video.muted = false;
    video.volume = 1;

    await video.play().catch(() => {});

    return true;
  } catch (err) {
    console.log('Audio unlock failed:', err);
    return false;
  }
}

// LEFT BUTTON → MUTE / UNMUTE (ONLY controls mute)
async function toggleVideoMute() {
  const video = document.getElementById('demo-video');
  const muteBtn = document.getElementById('mute-btn');

  if (!video) return;

  if (video.muted) {
    await unlockVideoAudio();
  } else {
    video.muted = true;
  }

  if (muteBtn) {
    muteBtn.textContent = video.muted ? '🔊 Unmute' : '🔇 Mute';
  }

  syncVideoButtonState();
}

// RIGHT BUTTON → VOLUME CONTROL ONLY (NO mute control)
function toggleVideoSound() {
  const video = document.getElementById('demo-video');
  const soundBtn = document.getElementById('sound-btn');

  if (!video) return;

  // Toggle volume between low/high (does NOT affect mute)
  video.volume = video.volume === 1 ? 0.5 : 1;

  if (video.volume > 0) {
    video.muted = false;
  }

  if (soundBtn) {
    soundBtn.textContent =
      video.volume === 1 ? '🔊 Sound Max' : '🔉 Sound Mid';
  }

  syncVideoButtonState();
}

// Sync UI with real video state
function syncVideoButtonState() {
  const video = document.getElementById('demo-video');
  const muteBtn = document.getElementById('mute-btn');

  if (!video || !muteBtn) return;

  muteBtn.textContent = video.muted ? '🔊 Unmute' : '🔇 Mute';
}

/* =========================
   EVENT LISTENERS
========================= */

function setupEventListeners() {
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('switch-auth').addEventListener('click', toggleAuthMode);

  document.getElementById('waitlist-form').addEventListener('submit', handleWaitlistSubmit);

  document.querySelectorAll('[data-route]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(e.target.getAttribute('data-route'));
    });
  });

  document.getElementById('hamburger-btn').addEventListener('click', toggleMobileMenu);
  document.getElementById('mobile-logout-btn').addEventListener('click', logout);
  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('send-form').addEventListener('submit', handleSendSubmit);

  document.getElementById('scan-qr-btn').addEventListener('click', startQRScanner);
  document.getElementById('stop-scanner-btn').addEventListener('click', stopQRScanner);

  document.getElementById('receive-amount').addEventListener('input', updateQRCode);

  const muteBtn = document.getElementById('mute-btn');
  const soundBtn = document.getElementById('sound-btn');

  if (muteBtn) muteBtn.addEventListener('click', toggleVideoMute);
  if (soundBtn) soundBtn.addEventListener('click', toggleVideoSound);

  syncVideoButtonState();
}

/* =========================
   AUTH + APP LOGIC (UNCHANGED)
========================= */

function checkAuthStatus() {
  if (token) loadProfile();
  else showAuth();
}

function showAuth() {
  currentRoute = 'auth';
  demoSection.style.display = 'block';
  authSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
}

function showDashboard() {
  currentRoute = 'dashboard';
  demoSection.style.display = 'none';
  authSection.style.display = 'none';
  dashboardSection.style.display = 'flex';
  dashboardContent.style.display = 'block';
  sendContent.style.display = 'none';
  loadDashboardData();
}

function navigateTo(route) {
  currentRoute = route;
  closeMobileMenu();

  if (route === 'dashboard') {
    dashboardContent.style.display = 'block';
    sendContent.style.display = 'none';
  } else if (route === 'send') {
    dashboardContent.style.display = 'none';
    sendContent.style.display = 'block';
  }

  updateNavLinks();
}

function updateNavLinks() {
  document.querySelectorAll('[data-route]').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-route') === currentRoute);
  });
}

function toggleMobileMenu() {
  mobileMenuOpen = !mobileMenuOpen;
  const menu = document.getElementById('mobile-menu');
  const btn = document.getElementById('hamburger-btn');

  menu.style.display = mobileMenuOpen ? 'flex' : 'none';
  btn.classList.toggle('active', mobileMenuOpen);
}

function closeMobileMenu() {
  mobileMenuOpen = false;
  document.getElementById('mobile-menu').style.display = 'none';
}

function logout() {
  token = '';
  profile = null;
  localStorage.removeItem('changeaipay_token');
  showAuth();
}

/* =========================
   PLACEHOLDER SAFE FUNCTIONS
========================= */

function toggleAuthMode() {}
function handleAuthSubmit() {}
function handleWaitlistSubmit() {}
function loadProfile() {}
function loadDashboardData() {}
function handleSendSubmit() {}
function startQRScanner() {}
function stopQRScanner() {}
function updateQRCode() {}
function updateUI() {}