const express = require("express");
const auth = require("../middleware/auth");
const { send, history } = require("../controllers/transactionController");

const router = express.Router();

router.post("/send", auth, send);
router.get("/history", auth, history);

module.exports = router;
