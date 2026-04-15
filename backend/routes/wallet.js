const express = require("express");
const auth = require("../middleware/auth");
const { me, createWallet, balance, sendPayment, dashboard } = require("../controllers/walletController");

const router = express.Router();

router.get("/me", auth, me);
router.get("/dashboard", auth, dashboard);
router.post("/create-wallet", auth, createWallet);
router.get("/balance", auth, balance);
router.post("/send-payment", auth, sendPayment);

module.exports = router;

