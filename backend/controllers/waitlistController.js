const WaitlistEntry = require("../models/WaitlistEntry");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function joinWaitlist(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    const existing = await WaitlistEntry.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: "Already registered" });
    }

    await WaitlistEntry.create({ email });

    return res.status(201).json({ success: true, message: "You're on the list" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: "Already registered" });
    }

    return res.status(500).json({ success: false, error: "Server error", details: String(err?.message || err) });
  }
}

module.exports = { joinWaitlist };
