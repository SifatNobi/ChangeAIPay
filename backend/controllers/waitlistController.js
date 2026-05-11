import WaitlistEntry from "../models/WaitlistEntry.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/[^\d+]/g, "").trim();
}

async function joinWaitlist(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    const existing = await WaitlistEntry.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: "Already registered" });
    }

    const entry = await WaitlistEntry.create({ 
      email,
      phone,
      source: req.body?.source || "web",
      referredBy: req.body?.referredBy || null,
      metadata: {
        country: req.body?.country || null,
        utmSource: req.body?.utmSource || null,
        utmMedium: req.body?.utmMedium || null,
        utmCampaign: req.body?.utmCampaign || null
      }
    });

    return res.status(201).json({ 
      success: true, 
      message: "You're on the list!",
      position: entry.createdAt.getTime()
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: "Already registered" });
    }

    return res.status(500).json({ success: false, error: "Server error", details: String(err?.message || err) });
  }
}

async function getWaitlistStats(req, res) {
  try {
    const total = await WaitlistEntry.countDocuments();
    const pending = await WaitlistEntry.countDocuments({ status: "pending" });
    const verified = await WaitlistEntry.countDocuments({ status: "verified" });
    const converted = await WaitlistEntry.countDocuments({ status: "converted" });
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await WaitlistEntry.countDocuments({ createdAt: { $gte: startOfDay } });
    
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const thisWeek = await WaitlistEntry.countDocuments({ createdAt: { $gte: startOfWeek } });
    
    res.json({
      success: true,
      stats: {
        total,
        pending,
        verified,
        converted,
        today,
        thisWeek
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
}

async function exportWaitlist(req, res) {
  try {
    const { format = "json", status } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const entries = await WaitlistEntry.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    if (format === "csv") {
      const csv = [
        "Email,Phone,Status,Source,Referred By,Created At",
        ...entries.map(e => 
          `"${e.email}","${e.phone || ""}","${e.status}","${e.source}","${e.referredBy || ""}","${e.createdAt.toISOString()}"`
        )
      ].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=waitlist.csv");
      return res.send(csv);
    }
    
    res.json({ success: true, entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
}

async function updateWaitlistEntry(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const entry = await WaitlistEntry.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true }
    );
    
    if (!entry) {
      return res.status(404).json({ success: false, error: "Entry not found" });
    }
    
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
}

export { joinWaitlist, getWaitlistStats, exportWaitlist, updateWaitlistEntry };
