// Global state
let currentRoute = 'auth';
let authMode = 'login';
let token = localStorage.getItem('changeaipay_token') || '';
let profile = null;
let mobileMenuOpen = false;

// API configuration
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://your-backend-url.com'; // Adjust for production

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
}

function setupEventListeners() {
  // Auth form
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('switch-auth').addEventListener('click', toggleAuthMode);

  // Waitlist form
  document.getElementById('waitlist-form').addEventListener('submit', handleWaitlistSubmit);

  // Navigation
  document.querySelectorAll('[data-route]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(e.target.getAttribute('data-route'));
    });
  });

  // Mobile menu
  document.getElementById('hamburger-btn').addEventListener('click', toggleMobileMenu);
  document.getElementById('mobile-logout-btn').addEventListener('click', logout);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Send form
  document.getElementById('send-form').addEventListener('submit', handleSendSubmit);

  // QR scanner
  document.getElementById('scan-qr-btn').addEventListener('click', startQRScanner);
  document.getElementById('stop-scanner-btn').addEventListener('click', stopQRScanner);

  // Receive amount
  document.getElementById('receive-amount').addEventListener('input', updateQRCode);

  // Video audio control - separate mute/unmute and sound controls
  const muteBtn = document.getElementById('mute-btn');
  const soundBtn = document.getElementById('sound-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleVideoMute);
    syncVideoButtonState();
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', toggleVideoSound);
  }
}

function checkAuthStatus() {
  if (token) {
    loadProfile();
  } else {
    showAuth();
  }
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
  } else if (route === 'receive') {
    dashboardContent.style.display = 'block';
    sendContent.style.display = 'none';
    document.getElementById('receive-section').scrollIntoView({ behavior: 'smooth' });
  } else if (route === 'history') {
    dashboardContent.style.display = 'block';
    sendContent.style.display = 'none';
    document.getElementById('history-section').scrollIntoView({ behavior: 'smooth' });
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

  if (mobileMenuOpen) {
    menu.style.display = 'flex';
    btn.classList.add('active');
  } else {
    menu.style.display = 'none';
    btn.classList.remove('active');
  }
}

function closeMobileMenu() {
  mobileMenuOpen = false;
  document.getElementById('mobile-menu').style.display = 'none';
  document.getElementById('hamburger-btn').classList.remove('active');
}

function toggleAuthMode(e) {
  e.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Login' : 'Register';
  document.getElementById('auth-submit').textContent = authMode;
  document.getElementById('switch-auth').textContent = authMode === 'login'
    ? 'Need an account? Register'
    : 'Already have an account? Login';
  document.getElementById('register-fields').style.display = authMode === 'register' ? 'block' : 'none';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    name: formData.get('name') || '',
    email: formData.get('email'),
    password: formData.get('password')
  };

  try {
    const endpoint = authMode === 'register' ? '/register' : '/login';
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Authentication failed');

    token = data.token;
    localStorage.setItem('changeaipay_token', token);
    await loadProfile();
    showDashboard();
  } catch (error) {
    showAuthError(error.message);
  }
}

async function handleWaitlistSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('waitlist-email').value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showWaitlistStatus('Please enter a valid email.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to join waitlist');

    showWaitlistStatus('You\'re on the list!', 'success');
    document.getElementById('waitlist-email').value = '';
  } catch (error) {
    showWaitlistStatus(error.message, 'error');
  }
}

function showAuthError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function showWaitlistStatus(message, type) {
  const statusEl = document.getElementById('waitlist-status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
}

async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to load profile');

    profile = await response.json();
    updateProfileUI();
  } catch (error) {
    console.error('Profile load error:', error);
    logout();
  }
}

function updateProfileUI() {
  if (!profile) return;

  document.getElementById('merchant-name').textContent = profile.user?.name || 'User';
  document.getElementById('wallet-address').textContent = profile.walletAddress || 'nano_...';
  document.getElementById('receive-wallet-address').textContent = profile.walletAddress || 'Wallet not available';
  document.getElementById('balance-amount').textContent = formatAmount(profile.balance?.balanceNano || '0');
}

function formatAmount(amount) {
  return parseFloat(amount).toFixed(2) + ' XNO';
}

async function loadDashboardData() {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      updateTransactionList(data.transactions || []);
    }
  } catch (error) {
    console.error('Transaction load error:', error);
  }
}

function updateTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  const count = document.getElementById('transaction-count');

  count.textContent = `${transactions.length} entries`;

  if (transactions.length === 0) {
    list.innerHTML = '<div class="empty-state">No transactions yet — your payments will appear here.</div>';
    return;
  }

  list.innerHTML = transactions.map(tx => `
    <div class="transaction-card ${tx.type === 'received' ? 'incoming' : ''}">
      <div class="tx-icon">${tx.type === 'received' ? '↓' : '↑'}</div>
      <div class="tx-main">
        <p class="tx-amount">${tx.type === 'received' ? '+' : '-'}${formatAmount(tx.amount)}</p>
        <p class="tx-meta">${new Date(tx.timestamp).toLocaleDateString()}</p>
      </div>
      <div class="tx-state">confirmed</div>
    </div>
  `).join('');
}

function updateQRCode() {
  const amount = document.getElementById('receive-amount').value.trim();
  const container = document.getElementById('qr-container');

  if (!amount || isNaN(amount) || amount <= 0) {
    container.innerHTML = '<div class="empty-qr"><p class="muted">Add amount to generate QR</p></div>';
    return;
  }

  const walletAddress = profile?.walletAddress;
  if (!walletAddress) {
    container.innerHTML = '<div class="empty-qr"><p class="muted">Wallet not available</p></div>';
    return;
  }

  const uri = `nano:${walletAddress}?amount=${amount}`;
  QRCode.toCanvas(uri, { width: 320, margin: 1 }, (error, canvas) => {
    if (error) {
      container.innerHTML = '<div class="empty-qr"><p class="muted">Error generating QR</p></div>';
      return;
    }
    container.innerHTML = '';
    container.appendChild(canvas);
  });
}

let html5QrCode = null;

async function startQRScanner() {
  if (html5QrCode) return;

  try {
    html5QrCode = new Html5Qrcode("qr-scanner");
    document.getElementById('qr-scanner-container').style.display = 'block';

    await html5QrCode.start(
      { facingMode: { exact: "environment" } },
      { fps: 10, qrbox: 250, disableFlip: true },
      (decodedText) => {
        document.getElementById('send-recipient').value = decodedText;
        stopQRScanner();
        showSendStatus('QR scanned. Recipient autofilled.', 'success');
      },
      () => {}
    );
  } catch (error) {
    console.error('QR Scanner error:', error);
    document.getElementById('scan-error').textContent = 'Unable to access camera. Please enter the recipient manually.';
    document.getElementById('scan-error').style.display = 'block';
  }
}

async function stopQRScanner() {
  if (!html5QrCode) return;

  try {
    await html5QrCode.stop();
    await html5QrCode.clear();
  } catch (error) {
    console.error('Stop scanner error:', error);
  }

  html5QrCode = null;
  document.getElementById('qr-scanner-container').style.display = 'none';
}

async function handleSendSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    recipient: formData.get('recipient'),
    amount: formData.get('amount')
  };

  try {
    const response = await fetch(`${API_BASE_URL}/transaction/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Send failed');

    showSendStatus('Payment submitted successfully!', 'success');
    e.target.reset();
    loadDashboardData();
  } catch (error) {
    showSendStatus(error.message, 'error');
  }
}

function showSendStatus(message, type) {
  const statusEl = document.getElementById('send-status');
  statusEl.innerHTML = `<strong>${type === 'error' ? '❌' : '✅'}</strong> <p>${message}</p>`;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
}

function logout() {
  token = '';
  profile = null;
  localStorage.removeItem('changeaipay_token');
  closeMobileMenu();
  showAuth();
}

// Sync button state with video.muted (single source of truth)
function syncVideoButtonState() {
  const video = document.getElementById('demo-video');
  const muteBtn = document.getElementById('mute-btn');
  if (!video || !muteBtn) return;
  
  // Button text reflects actual video mute state
  muteBtn.textContent = video.muted ? '🔊 Unmute' : '🔇 Mute';
}

// Toggle video mute/unmute - LEFT button controls audio on/off
async function toggleVideoMute() {
  const video = document.getElementById('demo-video');
  const muteBtn = document.getElementById('mute-btn');
  const soundBtn = document.getElementById('sound-btn');
  
  if (!video || !muteBtn) return;
  
  // Toggle the muted state
  video.muted = !video.muted;
  
  // If unmuting, ensure maximum volume
  if (!video.muted) {
    video.volume = 1;
    if (soundBtn) {
      soundBtn.textContent = '🔊 Sound On';
    }
  }
  
  // Always attempt to play the video when toggling mute
  try {
    await video.play();
  } catch (error) {
    // Play may fail due to autoplay policy, but mute state is still set correctly
    console.log('Video play request did not complete:', error);
  }
  
  // Sync button to reflect new state
  syncVideoButtonState();
}

// Toggle sound/volume - RIGHT button controls audio volume
async function toggleVideoSound() {
  const video = document.getElementById('demo-video');
  const soundBtn = document.getElementById('sound-btn');
  const muteBtn = document.getElementById('mute-btn');
  
  if (!video || !soundBtn) return;
  
  // If currently muted, unmute and enable sound
  if (video.muted) {
    video.muted = false;
    video.volume = 1;
    soundBtn.textContent = '🔊 Sound On';
    
    // Sync mute button state
    if (muteBtn) {
      muteBtn.textContent = '🔇 Mute';
    }
  } else {
    // If already unmuted, just ensure volume is up
    video.volume = 1;
    soundBtn.textContent = '🔊 Sound On';
  }
  
  // Always attempt to play the video
  try {
    await video.play();
  } catch (error) {
    console.log('Video play request did not complete:', error);
  }
}

function updateUI() {
  if (token && profile) {
    showDashboard();
  } else {
    showAuth();
  }
}