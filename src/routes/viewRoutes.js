const express = require("express");
const router = express.Router();
const { getLoginPage, getRegisterPage } = require("../controllers/viewController");

router.get("/login", getLoginPage);
router.get("/register", getRegisterPage);

module.exports = router;
