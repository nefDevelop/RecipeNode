const express = require("express");
const router = express.Router();
const { getPlanningPage, getPlanningData, savePlanningData, generatePlanningList } = require("../controllers/planningController");
const shoppingListController = require("../controllers/shoppingListController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

router.get("/planning", isAuthenticated, getPlanningPage);
router.get("/")
router.get("/api/planning", isAuthenticated, getPlanningData);
router.post("/api/planning", isAuthenticated, savePlanningData);
router.get("/api/planning/list", isAuthenticated, generatePlanningList);
router.get("/api/shopping-list", isAuthenticated, shoppingListController.generateShoppingList);

module.exports = router;
