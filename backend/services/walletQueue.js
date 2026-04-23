/**
 * Lightweight Mongo-backed wallet provisioning queue (no Redis).
 * - Enqueue wallet provisioning jobs per user
 * - Process due jobs with exponential backoff
 * - Persist job state (pending/in_progress/success/failed)
 * - Update User.walletStatus: pending -> active | failed
 */
import WalletJob from "../models/WalletJob.js";
import User from "../models/User.js";
import { createWalletAndAccount } from "./../services/nano.js";

let isWorkerRunning = false;
const DELAYS = [1000, 2000, 4000, 8000, 16000]; // ms for retries 1..5

function enqueueWalletJob(userId) {
  return WalletJob.create({ userId, status: "pending", nextRunAt: new Date() });
}

async function retryWalletForUser(userId) {
  // Reset existing job if present, or create new one
  const existing = await WalletJob.findOne({ userId }).sort({ createdAt: -1 });
  if (existing) {
    existing.status = "pending";
    existing.nextRunAt = new Date();
    existing.retries = 0;
    existing.lastError = null;
    await existing.save();
  } else {
    await enqueueWalletJob(userId);
  }
  // Ensure worker is aware (no explicit signal needed for this simple loop)
  return true;
}

async function _provisionForUser(user) {
  // If already active, skip
  if (user.walletAddress && user.walletStatus === "active") {
    return { ok: true };
  }
  // Try to generate wallet keys locally
  const { privateKey, address } = await createWalletAndAccount();
  user.privateKey = privateKey;
  user.walletAddress = address;
  user.walletStatus = "active";
  user.walletCreatedAt = new Date();
  await user.save();
  return { ok: true };
}

async function processWalletJob(job) {
  if (!job) return;
  try {
    const user = await User.findById(job.userId);
    if (!user) {
      await WalletJob.findByIdAndUpdate(job._id, { status: 'failed', lastError: 'User not found' });
      return;
    }

    // If user already active, mark job success
    if (user.walletAddress && user.walletStatus === 'active') {
      await WalletJob.findByIdAndUpdate(job._id, { status: 'success' });
      return;
    }

    // Attempt provisioning (idempotent for repeated runs)
    try {
      await _provisionForUser(user);
      await WalletJob.findByIdAndUpdate(job._id, { status: 'success' });
      return;
    } catch (err) {
      // Provisioning failed for this run
      const nextRetries = (job.retries || 0) + 1;
      const maxRetries = job.maxRetries || 5;
      if (nextRetries >= maxRetries) {
        await WalletJob.findByIdAndUpdate(job._id, {
          status: 'failed',
          lastError: String(err?.message || err)
        });
        user.walletStatus = 'failed';
        await user.save().catch(() => {});
      } else {
        const delay = DELAYS[Math.min(nextRetries - 1, DELAYS.length - 1)];
        await WalletJob.findByIdAndUpdate(job._id, {
          status: 'pending',
          retries: nextRetries,
          nextRunAt: new Date(Date.now() + delay),
          lastError: String(err?.message || err)
        });
      }
      return;
    }
  } catch (err) {
    // Unexpected error
    await WalletJob.findByIdAndUpdate(job._id, { status: 'failed', lastError: String(err?.message || err) });
  }
}

async function processDueJobs() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  try {
    const now = new Date();
    const job = await WalletJob.findOne({ status: 'pending', nextRunAt: { $lte: now } })
      .sort({ createdAt: 1 });
    if (!job) { isWorkerRunning = false; return; }
    await WalletJob.findByIdAndUpdate(job._id, { status: 'in_progress' });
    await processWalletJob(job);
  } catch (err) {
    console.error('[walletQueue] Processing error:', String(err?.message || err));
  } finally {
    isWorkerRunning = false;
  }
}

function startWorker(intervalMs = 5000) {
  // Avoid multiple intervals
  if (startWorker._started) return;
  startWorker._started = true;
  // Run immediately and then on schedule
  processDueJobs();
  setInterval(processDueJobs, intervalMs);
}

export default {
  enqueueWalletJob,
  retryWalletForUser,
  processDueJobs,
  startWorker
};
