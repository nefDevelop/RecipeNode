const express = require("express");
const path = require("path");
const db = require("./src/config/database");
const fs = require("fs").promises;
const { setupDatabase } = require("./src/config/databaseSetup");
const routes = require("./src/routes");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();
const port = 8214;

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

// Middleware para comprobar si el usuario es administrador
const isAdmin = (req, res, next) => {
  if (req.session && req.session.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Acceso denegado. Se requiere rol de administrador." });
};

// Ruta para eliminar una receta
app.delete("/api/recipes", isAdmin, async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "El título de la receta es requerido." });
  }

  try {
    // 1. Eliminar de la base de datos
    const dbDelete = new Promise((resolve, reject) => {
      db.run("DELETE FROM recipes WHERE name = ?", [title], function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
    const changes = await dbDelete;

    // 2. Eliminar el archivo .md
    const recipeFilePath = path.join(__dirname, "recetas", `${title}.md`);
    let fileDeleted = false;
    try {
      await fs.unlink(recipeFilePath);
      fileDeleted = true;
    } catch (fileErr) {
      if (fileErr.code !== "ENOENT") throw fileErr; // Volver a lanzar si es un error diferente a "no encontrado"
    }

    if (changes === 0 && !fileDeleted) {
      return res.status(404).json({ error: `La receta "${title}" no fue encontrada.` });
    }

    res.status(200).json({ message: "Receta eliminada correctamente." });
  } catch (err) {
    console.error(`Error al eliminar la receta "${title}":`, err);
    res.status(500).json({ error: "Error interno del servidor al eliminar la receta." });
  }
});

// Nueva ruta para guardar el plan de un día completo (Desayuno, Almuerzo, Cena)
app.post("/api/planning/day", isAdmin, (req, res) => {
  const { date, meals } = req.body;

  if (!date || !meals) {
    return res.status(400).json({ error: "Se requieren la fecha y las comidas." });
  }

  // Usamos una transacción para asegurar que todas las operaciones se completen o ninguna lo haga.
  db.serialize(() => {
    db.run("BEGIN TRANSACTION;");

    // Primero, borramos las entradas existentes para ese día para evitar conflictos.
    db.run("DELETE FROM planning WHERE date = ?", [date]);

    const stmt = db.prepare("INSERT INTO planning (date, meal_type, recipe_name) VALUES (?, ?, ?)");

    // Iteramos sobre las comidas enviadas (breakfast, lunch, dinner)
    for (const mealType in meals) {
      const recipeName = meals[mealType];
      // Solo insertamos si se ha seleccionado una receta para ese tipo de comida.
      if (recipeName && recipeName !== "") {
        stmt.run(date, mealType, recipeName);
      }
    }

    stmt.finalize((err) => {
      if (err) {
        db.run("ROLLBACK;");
        return res.status(500).json({ error: "Error al finalizar la inserción." });
      }
      db.run("COMMIT;", (commitErr) => {
        if (commitErr) return res.status(500).json({ error: "Error al guardar la planificación." });
        res.status(200).json({ message: "Planificación guardada correctamente." });
      });
    });
  });
});

// Nueva ruta para limpiar un día completo de la planificación
app.delete("/api/planning/day", (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: "La fecha es requerida." });
  }
  db.run("DELETE FROM planning WHERE date = ?", [date], function (err) {
    if (err) {
      console.error(`Error al limpiar el día ${date}:`, err);
      return res.status(500).json({ error: "Error de base de datos al limpiar el día." });
    }
    res.status(200).json({ message: "Día limpiado correctamente." });
  });
});

// Middleware to pass session user to all templates
app.use((req, res, next) => {
  res.locals.user = req.session;
  next();
});

// Middleware to pass all recipe titles to all templates for search functionality
app.use(async (req, res, next) => {
  try {
    const recipeRows = await new Promise((resolve, reject) =>
      db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => (err ? reject(err) : resolve(rows)))
    );
    res.locals.recipeTitles = recipeRows.map((r) => r.name);
  } catch (error) {
    console.error("Error fetching recipe titles for layout:", error);
    res.locals.recipeTitles = [];
  }
  next();
});

// Ruta para evitar el error 404 del favicon en las logs del navegador
app.get("/favicon.ico", (req, res) => res.status(204).send());

// Usar el enrutador principal
app.use("/", routes);

app.listen(port, () => {
  console.log(`Aplicación de recetas escuchando en http://localhost:${port}`);
});
