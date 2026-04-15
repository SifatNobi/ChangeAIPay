const express = require("express");
const auth = require("../middleware/auth");
const { list } = require("../controllers/transactionsController");

const router = express.Router();

router.get("/transactions", auth, list);

module.exports = router;

