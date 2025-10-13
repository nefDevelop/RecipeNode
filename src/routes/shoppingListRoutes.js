const express = require("express");
const router = express.Router();
const shoppingListController = require("../controllers/shoppingListController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Proteger todas las rutas de la lista de la compra
router.use(isAuthenticated);

// Rutas para la lista de la compra generada
router.get("/generate", shoppingListController.generateShoppingList);

// Rutas para la lista de la compra manual
router.get("/manual", shoppingListController.getManualList);
router.post("/manual", shoppingListController.addManualItem);
router.put("/manual/order", shoppingListController.updateManualListOrder);
router.put("/manual/:id", shoppingListController.updateManualItem);
router.delete("/manual/:id", shoppingListController.deleteManualItem);

module.exports = router;
