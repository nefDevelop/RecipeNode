const express = require("express");
const router = express.Router();
const tabController = require("../controllers/tabController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Proteger todas las rutas de pestañas con autenticación
router.use(isAuthenticated);

// Definir las rutas para la API de pestañas
router.get("/", tabController.getTabs);
router.post("/", tabController.createTab);
router.put("/:id", tabController.renameTab);
router.delete("/:id", tabController.deleteTab);
router.get("/:id/items", tabController.getTabItems);

module.exports = router;
