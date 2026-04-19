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
  if (!video) {
    console.error('Demo video element not found!');
    return;
  }

  // ONLY mute for autoplay compliance - volume stays at 1
  video.muted = true;
  video.volume = 1;

  console.log('Video initialized - muted:', video.muted, 'volume:', video.volume);

  // Add comprehensive error handling
  video.addEventListener('error', (e) => {
    console.error('Video loading error:', e.target.error);
  });

  video.addEventListener('loadeddata', () => {
    console.log('Video loaded successfully, ready for audio unlock');
  });

  video.addEventListener('canplay', () => {
    console.log('Video can play, audio should be available');
  });

  // Add global user interaction handler for audio unlock
  document.addEventListener('click', handleUserInteraction, { once: true });
  document.addEventListener('touchstart', handleUserInteraction, { once: true });

  // Also try to unlock on any button click
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      handleUserInteraction();
    }
  });
}

// Handle any user interaction to unlock audio context
async function handleUserInteraction() {
  const video = document.getElementById('demo-video');
  if (!video) return;

  try {
    // Try to unlock audio context on first user interaction
    if (video.muted) {
      await video.play().catch(() => {});
    }
    console.log('User interaction detected - audio context ready');
  } catch (err) {
    console.log('User interaction audio unlock failed:', err);
  }
}

// SINGLE audio unlock function - FORCE enables audio
async function unlockVideoAudio() {
  const video = document.getElementById('demo-video');
  if (!video) return false;

  try {
    // CRITICAL: Force unmute and max volume FIRST
    video.muted = false;
    video.volume = 1;

    // Force play to unlock browser audio context
    await video.play();

    // TRIPLE-check after play attempt (browsers can be stubborn)
    setTimeout(() => {
      if (video.muted) {
        video.muted = false;
        console.log('Forced unmute after timeout');
      }
      if (video.volume < 1) {
        video.volume = 1;
        console.log('Forced volume to 1 after timeout');
      }
    }, 100);

    // Verify audio is actually working
    console.log('Audio unlock attempt - final state: muted=', video.muted, 'volume=', video.volume);

    return !video.muted && video.volume > 0;
  } catch (err) {
    console.log('Audio unlock failed:', err);
    // Even on error, ensure correct state and try again
    video.muted = false;
    video.volume = 1;

    // Some browsers need a second attempt
    try {
      await video.play();
    } catch (retryErr) {
      console.log('Retry play also failed:', retryErr);
    }

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

// RIGHT BUTTON → ENABLE SOUND (forces audio unlock)
async function toggleVideoSound() {
  const video = document.getElementById('demo-video');
  const soundBtn = document.getElementById('sound-btn');
  const muteBtn = document.getElementById('mute-btn');

  if (!video || !soundBtn) {
    console.error('Video or sound button not found');
    return;
  }

  console.log('Enable sound button clicked - current state: muted=', video.muted, 'volume=', video.volume);

  // If video failed to load, try to reload it
  if (video.error || video.networkState === 2) {
    console.log('Video has error or failed to load, attempting reload...');
    video.load();
    await new Promise(resolve => {
      video.addEventListener('loadeddata', resolve, { once: true });
    });
  }

  // FORCE audio unlock - this is the main "enable sound" button
  const audioEnabled = await unlockVideoAudio();

  if (audioEnabled) {
    soundBtn.textContent = '🔊 Sound On';
    if (muteBtn) {
      muteBtn.textContent = '🔇 Mute';
    }
    console.log('✅ Audio successfully enabled - muted:', video.muted, 'volume:', video.volume);
  } else {
    console.log('❌ Audio enable failed - check browser autoplay policies');
    soundBtn.textContent = '🔇 Sound Failed';

    // Last resort: try to create audio context manually
    tryManualAudioUnlock();
  }
}

// Manual audio unlock using Web Audio API
function tryManualAudioUnlock() {
  try {
    if (window.AudioContext || window.webkitAudioContext) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Web Audio API context resumed manually');
        });
      }
    }
  } catch (err) {
    console.log('Manual audio unlock failed:', err);
  }
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

/* =========================
   DEBUG FUNCTIONS
========================= */

// Debug function - can be called from console
window.debugVideo = function() {
  const video = document.getElementById('demo-video');
  if (!video) {
    console.error('Video element not found');
    return;
  }

  console.log('=== VIDEO DEBUG INFO ===');
  console.log('muted:', video.muted);
  console.log('volume:', video.volume);
  console.log('paused:', video.paused);
  console.log('readyState:', video.readyState);
  console.log('networkState:', video.networkState);
  console.log('error:', video.error);
  console.log('currentSrc:', video.currentSrc);
  console.log('duration:', video.duration);
  console.log('audioTracks:', video.audioTracks ? video.audioTracks.length : 'N/A');
  console.log('========================');
};

// Test audio function - creates a test tone
window.testAudio = function() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5); // 0.5 second beep

    console.log('Test audio beep played');
  } catch (err) {
    console.error('Test audio failed:', err);
  }
};