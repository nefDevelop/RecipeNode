const express = require("express");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");

// Importar controladores
const recipeController = require("./src/controllers/recipeController");
const planningController = require("./src/controllers/planningController");
const authController = require("./src/controllers/authController");
const viewController = require("./src/controllers/viewController");
const settingsController = require("./src/controllers/settingsController");
const shoppingListController = require("./src/controllers/shoppingListController");

// Importar middlewares
const { isAuthenticated, isAdmin } = require("./src/middleware/authMiddleware");
const { provideRecipeTitles } = require("./src/middleware/recipeMiddleware");

const app = express();
const port = 3000;

// Configuración de la plantilla EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares de Express
app.use(express.static(path.join(__dirname, "public")));
app.use("/recetas", express.static(path.join(__dirname, "recetas")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la sesión
app.use(
  session({
    secret: "una-clave-secreta-muy-segura", // Cambia esto por una clave segura en un entorno real
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Poner a true si usas HTTPS
  })
);

// Middleware para pasar el usuario a todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session;
  next();
});

// --- RUTAS DE VISTAS (PÁGINAS) ---

// Página principal y de detalle de receta
app.get("/", isAuthenticated, provideRecipeTitles, recipeController.getHomePage);

// Página de login y registro
app.get("/login", viewController.getLoginPage);
app.get("/register", viewController.getRegisterPage);

// Página de planificación
app.get("/planning", isAuthenticated, provideRecipeTitles, planningController.getPlanningPage);

// Página de lista de la compra
app.get("/shopping-list", isAuthenticated, provideRecipeTitles, recipeController.getShoppingListPage);

// Página de ajustes
app.get("/settings", isAuthenticated, settingsController.getSettingsPage);

// --- RUTAS DE API ---

// API de Autenticación
app.post("/api/register", authController.register);
app.post("/api/login", authController.login);
app.get("/api/logout", authController.logout);

// API de Recetas
app.get("/api/recipes", isAuthenticated, recipeController.getAllRecipesApi);
app.get("/api/recipes/:id", isAuthenticated, recipeController.getRecipeByIdApi);
app.post("/api/recipes", isAuthenticated, recipeController.createRecipeApi);
app.post("/api/recipes/scrape", isAuthenticated, recipeController.scrapeRecipeApi);

// API de Planificación
app.get("/api/planning", isAuthenticated, planningController.getPlanningData);
app.post("/api/planning", isAuthenticated, planningController.savePlanningData);

// API de Lista de la Compra
app.get("/api/shopping-list", isAuthenticated, shoppingListController.generateShoppingList);

// API de Lista de la Compra MANUAL (NUEVAS RUTAS)
app.get("/api/shopping-list/manual", isAuthenticated, shoppingListController.getManualList);
app.post("/api/shopping-list/manual", isAuthenticated, shoppingListController.addManualItem);
app.put("/api/shopping-list/manual/:id", isAuthenticated, shoppingListController.updateManualItem);
app.delete("/api/shopping-list/manual/:id", isAuthenticated, shoppingListController.deleteManualItem);

// API de Ajustes
app.post("/api/settings", isAuthenticated, settingsController.updateSettings);

// --- MANEJO DE ERRORES ---

// Middleware para manejar 404
app.use((req, res, next) => {
  res.status(404).render("404", { title: "Página no encontrada" });
});

// Middleware para manejar otros errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Algo salió mal!");
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor RecipeNode escuchando en http://localhost:${port}`);
});
