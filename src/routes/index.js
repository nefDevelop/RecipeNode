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
const tabRoutes = require("./tabRoutes");
const shoppingListRoutes = require("./shoppingListRoutes");


router.use(recipeRoutes);
router.use(viewRoutes);

// Ruta para la página de inicio (listado de recetas)
router.get("/", isAuthenticated, recipeController.getHomePage);
router.use(planningRoutes);
router.use("/settings", settingsRoutes);
router.use("/api/auth", authRoutes); // Montar las rutas de autenticación bajo /api/auth
router.use("/api/tabs", tabRoutes); // Montar las rutas de pestañas bajo /api/tabs
router.use("/api/shopping-list", shoppingListRoutes); // Montar las rutas de la lista de la compra bajo /api/shopping-list

module.exports = router;
