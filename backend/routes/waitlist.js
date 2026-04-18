const express = require("express");
const { joinWaitlist } = require("../controllers/waitlistController");

const router = express.Router();

router.post("/", joinWaitlist);

module.exports = router;
