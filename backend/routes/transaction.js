const express = require("express");
const auth = require("../middleware/auth");
const { send, history, status } = require("../controllers/transactionController");

const router = express.Router();

router.post("/send", auth, send);
router.get("/history", auth, history);
router.get("/:id/status", auth, status);

module.exports = router;
