const express = require("express");
const router = express.Router();
const { getSettingsPage, updateSettings } = require("../controllers/settingsController");
const { isAuthenticated, isAuthenticatedView } = require("../middlewares/authMiddleware");

router.get("/", isAuthenticatedView, getSettingsPage);
router.post("/", isAuthenticated, updateSettings);
router.post("/image-folder", isAuthenticated, updateImageFolder);

module.exports = router;
