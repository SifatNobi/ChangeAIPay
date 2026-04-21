const express = require('express');
const router = express.Router();
const walletQueue = require('../services/walletQueue');

// Admin: retry wallet provisioning for a user
router.post('/retry/:userId', async (req, res) => {
  try {
    await walletQueue.retryWalletForUser(req.params.userId);
    res.json({ ok: true, message: 'Wallet provisioning re-queued' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

module.exports = router;
