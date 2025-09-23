const express = require("express");
const router = express.Router();

const recipeRoutes = require("./recipeRoutes");
const planningRoutes = require("./planningRoutes");
const settingsRoutes = require("./settingsRoutes");
const authRoutes = require("./authRoutes");
const viewRoutes = require("./viewRoutes");

router.use("/", recipeRoutes);
router.use("/", viewRoutes);
router.use("/", planningRoutes); // This will handle /planning, /api/planning, etc.
router.use("/settings", settingsRoutes);
router.use("/api/auth", authRoutes);

module.exports = router;
