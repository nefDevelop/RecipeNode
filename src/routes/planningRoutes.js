const express = require("express");
const router = express.Router();
const { getPlanningPage, getPlanningData, savePlanningData, getShoppingListApi } = require("../controllers/planningController");
const { isAuthenticated, isAuthenticatedView } = require("../middlewares/authMiddleware");

router.get("/planning", isAuthenticatedView, getPlanningPage);
router.get("/api/planning", isAuthenticated, getPlanningData);
router.post("/api/planning", isAuthenticated, savePlanningData);
router.get("/api/shopping-list", isAuthenticated, getShoppingListApi);

module.exports = router;
