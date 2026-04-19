// Video audio and page behavior helper script
const VIDEO_VOLUME = 1;
const demoVideo = document.getElementById('demo-video');
const muteBtn = document.getElementById('mute-btn');
const soundBtn = document.getElementById('sound-btn');

function initPage() {
  initializeVideoState();
  setupEventListeners();
}

function initializeVideoState() {
  if (!demoVideo) return;

  demoVideo.muted = true;
  demoVideo.volume = VIDEO_VOLUME;

  demoVideo.addEventListener('error', (event) => {
    console.error('Demo video error:', event.target.error);
  });

  document.addEventListener('click', handleUserInteraction, { once: true });
  document.addEventListener('touchstart', handleUserInteraction, { once: true });
}

async function handleUserInteraction() {
  if (!demoVideo) return;
  try {
    await demoVideo.play();
  } catch (err) {
    console.warn('User interaction did not unlock video immediately:', err);
  }
}

async function unlockVideoAudio() {
  if (!demoVideo) return false;

  demoVideo.muted = false;
  demoVideo.volume = VIDEO_VOLUME;

  try {
    await demoVideo.play();
  } catch (attemptError) {
    console.warn('unlockVideoAudio attempt failed:', attemptError);
    try {
      await demoVideo.play();
    } catch (retryError) {
      console.warn('unlockVideoAudio retry failed:', retryError);
    }
  }

  setTimeout(() => {
    if (demoVideo.muted) demoVideo.muted = false;
    if (demoVideo.volume < VIDEO_VOLUME) demoVideo.volume = VIDEO_VOLUME;
    syncVideoButtonState();
  }, 100);

  return !demoVideo.muted;
}

async function toggleVideoMute(event) {
  if (!demoVideo) return;

  demoVideo.muted = !demoVideo.muted;
  if (!demoVideo.muted) {
    await unlockVideoAudio();
  }
  syncVideoButtonState();

  if (event && event.cancelable) {
    event.preventDefault();
  }
}

async function toggleVideoSound(event) {
  if (!demoVideo) return;

  const enabled = await unlockVideoAudio();
  if (enabled) {
    if (soundBtn) soundBtn.textContent = '🔊 Sound On';
    if (muteBtn) muteBtn.textContent = '🔇 Mute';
  } else {
    if (soundBtn) soundBtn.textContent = '⚠️ Sound Failed';
    tryManualAudioUnlock();
  }
  syncVideoButtonState();

  if (event && event.cancelable) {
    event.preventDefault();
  }
}

function tryManualAudioUnlock() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('Web Audio manual unlock failed:', err);
  }
}

function syncVideoButtonState() {
  if (!demoVideo) return;
  if (muteBtn) {
    muteBtn.textContent = demoVideo.muted ? '🔊 Unmute' : '🔇 Mute';
  }
  if (soundBtn && !demoVideo.muted) {
    soundBtn.textContent = '🔊 Sound On';
  }
}

function setupEventListeners() {
  if (muteBtn) muteBtn.addEventListener('click', toggleVideoMute);
  if (soundBtn) soundBtn.addEventListener('click', toggleVideoSound);

  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', (e) => e.preventDefault());

  const waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) waitlistForm.addEventListener('submit', (e) => e.preventDefault());

  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
      mobileMenu.style.display = mobileMenu.style.display === 'flex' ? 'none' : 'flex';
    }
  });
}

window.addEventListener('DOMContentLoaded', initPage);
