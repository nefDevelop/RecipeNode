const express = require("express");
const router = express.Router();
const { getAllRecipesApi, getRecipeByIdApi, createRecipeApi, scrapeRecipeApi, getAvailableFiltersApi } = require("../controllers/recipeController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Rutas para la API (JSON)
router.get("/api/recipes/filters", getAvailableFiltersApi); // New route for fetching available filters
router.get("/api/recipes", getAllRecipesApi);
router.get("/api/recipes/search", getAllRecipesApi); // New search route
router.post("/api/recipes", isAuthenticated, createRecipeApi);
router.post("/api/recipes/scrape", isAuthenticated, scrapeRecipeApi);
router.get("/api/recipes/:id", getRecipeByIdApi);

module.exports = router;
