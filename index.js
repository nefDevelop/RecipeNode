const express = require("express");
const path = require("path");
const db = require("./src/config/database");
const { setupDatabase } = require("./src/config/databaseSetup");
const routes = require("./src/routes");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();
const port = 3000;

const recipesPath = path.join(__dirname, "recetas");
setupDatabase(db, recipesPath);

// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use("/_resources", express.static(path.join(__dirname, "recetas/_resources")));
app.use("/attachment", express.static(path.join(__dirname, "recetas/attachment")));
app.use(express.json()); // Para parsear JSON en las peticiones API
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: "./", // Almacena la DB de sesiones en la raíz del proyecto
    }),
    secret: "un-secreto-muy-secreto-que-deberia-estar-en-env", // Cambiar por una variable de entorno en producción
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semana
      httpOnly: true,
    },
  })
);

// Middleware to pass session user to all templates
app.use((req, res, next) => {
  res.locals.user = req.session;
  next();
});

// Ruta para evitar el error 404 del favicon en las logs del navegador
app.get("/favicon.ico", (req, res) => res.status(204).send());

// Usar el enrutador principal
app.use("/", routes);

app.listen(port, () => {
  console.log(`Aplicación de recetas escuchando en http://localhost:${port}`);
});
