const express = require("express");
const router = express.Router();
const {
  getHomePage,
  getShoppingListPage,
  getAllRecipesApi,
  getRecipeByIdApi,
  createRecipeApi,
  scrapeRecipeApi,
} = require("../controllers/recipeController");
const { isAuthenticated, isAuthenticatedView } = require("../middlewares/authMiddleware");

// Rutas para las vistas (páginas web)
router.get("/", getHomePage);
router.get("/shopping-list", isAuthenticatedView, getShoppingListPage);

// Rutas para la API (JSON)
router.get("/api/recipes", getAllRecipesApi);
router.post("/api/recipes", isAuthenticated, createRecipeApi);
router.post("/api/recipes/scrape", isAuthenticated, scrapeRecipeApi);
router.get("/api/recipes/:id", getRecipeByIdApi);

module.exports = router;
