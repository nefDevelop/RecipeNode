const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const planningController = require("../controllers/planningController");
const viewController = require("../controllers/viewController");

// Ruta para la página principal que muestra la lista o una receta
router.get("/", recipeController.getHomePage);

// Ruta para la nueva página de la lista de la compra
router.get("/shopping-list", async (req, res) => {
  try {
    // Necesitamos los títulos de las recetas para la barra lateral
    const recipeTitles = await recipeController.getAllRecipeTitles();
    res.render("shopping-list", {
      title: "Lista de la Compra",
      recipeTitles: recipeTitles,
      user: req.session,
    });
  } catch (error) {
    console.error("Error al renderizar la página de la lista de la compra:", error);
    res.status(500).send("Error al cargar la página.");
  }
});

// Ruta para la página de planificación
router.get("/planning", planningController.getPlanningPage);

// Rutas para login y registro
router.get("/login", viewController.getLoginPage);
router.get("/register", viewController.getRegisterPage);

module.exports = router;
