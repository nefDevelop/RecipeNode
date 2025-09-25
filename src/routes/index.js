const express = require("express");
const router = express.Router();

// Importar controladores
const recipeController = require("../controllers/recipeController");
const planningController = require("../controllers/planningController");
const authController = require("../controllers/authController");
const viewController = require("../controllers/viewController");
const settingsController = require("../controllers/settingsController");
const shoppingListController = require("../controllers/shoppingListController");

// Importar middlewares
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Importar archivos de rutas específicas
const recipeRoutes = require("./recipeRoutes");
const planningRoutes = require("./planningRoutes");
const settingsRoutes = require("./settingsRoutes");
const authRoutes = require("./authRoutes");
const viewRoutes = require("./viewRoutes");

router.use(recipeRoutes);
router.use(viewRoutes);
router.use(planningRoutes);
router.use(settingsRoutes);
router.use(authRoutes);

// Rutas de la API de la lista de la compra manual (para asegurar que estén registradas)
router.get("/api/shopping-list/manual", isAuthenticated, shoppingListController.getManualList);
router.post("/api/shopping-list/manual", isAuthenticated, shoppingListController.addManualItem);
router.put("/api/shopping-list/manual/:id", isAuthenticated, shoppingListController.updateManualItem);
router.delete("/api/shopping-list/manual/:id", isAuthenticated, shoppingListController.deleteManualItem);

module.exports = router;
