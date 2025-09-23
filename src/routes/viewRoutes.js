const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");

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
    });
  } catch (error) {
    console.error("Error al renderizar la página de la lista de la compra:", error);
    res.status(500).send("Error al cargar la página.");
  }
});

module.exports = router;
