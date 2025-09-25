const express = require("express");
const router = express.Router();
const { getPlanningPage, getPlanningData, savePlanningData } = require("../controllers/planningController");
const shoppingListController = require("../controllers/shoppingListController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

router.get("/planning", isAuthenticated, getPlanningPage);
router.get("/api/planning", isAuthenticated, getPlanningData);
router.post("/api/planning", isAuthenticated, savePlanningData);
router.get("/api/shopping-list", isAuthenticated, shoppingListController.generateShoppingList);

module.exports = router;
