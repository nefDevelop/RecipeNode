const express = require("express");
const router = express.Router();
const { register, login, logout } = require("../controllers/authController");
const { isAdmin } = require("../middlewares/authMiddleware");

// Solo el admin crea usuarios. Sin registro público.
router.post("/register", isAdmin, register);
router.post("/login", login);
router.get("/logout", logout);

module.exports = router;
