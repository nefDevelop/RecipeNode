const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const planningController = require("../controllers/planningController");
const viewController = require("../controllers/viewController");

// Ruta para la página principal que muestra la lista o una receta
router.get("/", recipeController.getHomePage);

// Ruta para la nueva página de la lista de la compra
router.get("/shopping-list", (req, res) => {
  // async no es necesario aquí
  // Las variables 'user' y 'recipeTitles' son proporcionadas por middlewares globales,
  // por lo que están disponibles automáticamente en la vista.
  res.render("shopping-list", {
    title: "Lista de la Compra",
    metadataOptions: res.locals.metadataOptions, // Asegurarse de que los modales tengan las opciones
  });
});

// Ruta para la página de planificación
router.get("/planning", planningController.getPlanningPage);

// Rutas para login y registro
router.get("/login", viewController.getLoginPage);
router.get("/register", viewController.getRegisterPage);

module.exports = router;
