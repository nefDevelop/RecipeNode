const express = require("express");
const path = require("path");
require("dotenv").config(); // Carga las variables de entorno desde .env
const env = require("./src/config/env");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const db = require("./src/config/database"); // Asegúrate que esto inicializa la DB
const fs = require("fs");
const { setupDatabase } = require("./src/config/databaseSetup");
const routes = require("./src/routes");
const session = require("express-session");
const shoppingListController = require("./src/controllers/shoppingListController");
const settingsController = require("./src/controllers/settingsController");
const SQLiteStore = require("connect-sqlite3")(session);
const http = require("http");
const { init: initSocket } = require("./src/socket");

const app = express();
const port = env.port;

// Detrás de Caddy/Traefik/Nginx pon TRUST_PROXY=1 para IP real y cookies secure.
if (env.trustProxy === "1") {
  app.set("trust proxy", 1);
}

// Cabeceras seguras + logs HTTP mínimos para prod.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(env.isProd ? "combined" : "dev"));

// Anti brute-force solo en auth, para no romper la UI.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, prueba más tarde." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// --- Database Promise Wrappers ---
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

// Migración: Añadir la columna 'order_index' a la tabla 'manual_shopping_items' si no existe.
// Esto es para soportar el ordenamiento manual (drag-and-drop).
db.run("ALTER TABLE manual_shopping_items ADD COLUMN order_index INTEGER", (err) => {
  // Ignoramos el error si la columna ya existe, que es lo esperado en ejecuciones posteriores.
  if (err && !err.message.includes("duplicate column name")) {
    console.error("Error al migrar la tabla manual_shopping_items:", err);
  }
});

// Migración: Añadir la columna 'created_at' a la tabla 'recipes' si no existe.
db.run("ALTER TABLE recipes ADD COLUMN created_at DATETIME", (err) => {
  if (err && !err.message.includes("duplicate column name")) {
    console.error("Error al migrar la tabla recipes (created_at):", err);
  }
});
const recipesPath = env.recipesDir;
setupDatabase(db, recipesPath);

// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.static(path.join(__dirname, "public")));

app.use("/attachment", express.static(path.join(env.recipesDir, "attachment")));
app.use(express.json()); // Para parsear JSON en las peticiones API
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: env.dataDir, // Fuera del contenedor: ./data:/app/data
    }),
    secret: env.sessionSecret, // Sin fallback: env.js aborta en prod si falta
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12h en vez de 7 días
      httpOnly: true,
      sameSite: "lax",
      // Sin dominio aún (http interno): false. Tras proxy TLS pon COOKIE_SECURE=1.
      secure: process.env.COOKIE_SECURE === "1",
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

// Middleware para comprobar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: "Acceso denegado. Debes iniciar sesión." });
};

// Ruta para eliminar una receta (movida a su propio controlador/router, pero la dejamos aquí por si se usa)
app.delete("/api/recipes", isAdmin, async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "El título de la receta es requerido." });
  }

  try {
    const recipeRow = await dbGet("SELECT path FROM recipes WHERE name = ?", [title]);

    if (!recipeRow) {
      return res.status(404).json({ error: `La receta "${title}" no fue encontrada.` });
    }

    // 1. Eliminar el archivo .md
    const recipeFilePath = recipeRow.path;
    let fileDeleted = false;
    try {
      if (fs.existsSync(recipeFilePath)) {
        fs.unlinkSync(recipeFilePath);
      }
      fileDeleted = true;
      console.log(`Archivo eliminado: ${recipeFilePath}`);
    } catch (fileErr) {
      if (fileErr.code !== "ENOENT") throw fileErr; // Volver a lanzar si es un error diferente a "no encontrado"
    }

    // 2. Eliminar la receta de la base de datos
    const { changes } = await dbRun("DELETE FROM recipes WHERE name = ?", [title]);

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
app.post("/api/planning/day", isAuthenticated, async (req, res) => {
  const { date, meals } = req.body;

  if (!date || !meals) {
    return res.status(400).json({ error: "Se requieren la fecha y las comidas." });
  }

  try {
    // Usamos una transacción para asegurar que todas las operaciones se completen o ninguna lo haga.
    await dbRun("BEGIN TRANSACTION;");

    // Primero, borramos las entradas existentes para ese día para evitar conflictos.
    await dbRun("DELETE FROM planning WHERE date = ?", [date]);

    // Creamos un array de promesas para todas las inserciones.
    const insertPromises = Object.entries(meals)
      .filter(([, recipeName]) => recipeName && recipeName !== "") // Solo insertamos si hay receta
      .map(([mealType, recipeName]) => {
        return dbRun("INSERT INTO planning (date, meal_type, recipe_name) VALUES (?, ?, ?)", [date, mealType, recipeName]);
      });

    await Promise.all(insertPromises); // Ejecutamos todas las inserciones

    await dbRun("COMMIT;");
    res.status(200).json({ message: "Planificación guardada correctamente." });
  } catch (error) {
    await dbRun("ROLLBACK;");
    console.error("Error al guardar la planificación del día:", error);
    return res.status(500).json({ error: "Error al guardar la planificación." });
  }
});

// Nueva ruta para limpiar un día completo de la planificación
app.delete("/api/planning/day", isAuthenticated, async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: "La fecha es requerida." });
  }
  try {
    await dbRun("DELETE FROM planning WHERE date = ?", [date]);
    res.status(200).json({ message: "Día limpiado correctamente." });
  } catch (error) {
    console.error(`Error al limpiar el día ${date}:`, error);
    return res.status(500).json({ error: "Error de base de datos al limpiar el día." });
  }
});

// Nueva ruta para actualizar el orden de la lista manual
app.put("/api/shopping-list/manual/order", shoppingListController.updateManualListOrder);

// Middleware to pass session user to all templates
app.use((req, res, next) => {
  res.locals.user = req.session;
  next();
});

// Middleware to pass all recipe titles to all templates for search functionality
app.use(async (req, res, next) => {
  try {
    const [recipeRows, difficulties, equipments, mealTypes, cuisineTypes, tags] = await Promise.all([
      dbAll("SELECT name FROM recipes ORDER BY name"),
      dbAll("SELECT DISTINCT difficulty FROM recipes WHERE difficulty IS NOT NULL AND difficulty != '' ORDER BY difficulty"),
      dbAll("SELECT DISTINCT equipment FROM recipes WHERE equipment IS NOT NULL AND equipment != '' ORDER BY equipment"),
      dbAll("SELECT DISTINCT meal_type FROM recipes WHERE meal_type IS NOT NULL AND meal_type != '' ORDER BY meal_type"),
      dbAll("SELECT DISTINCT cuisine_type FROM recipes WHERE cuisine_type IS NOT NULL AND cuisine_type != '' ORDER BY cuisine_type"),
      dbAll("SELECT tags FROM recipes WHERE tags IS NOT NULL AND tags != ''"),
    ]);

    const processField = (rows, fieldName) => {
      const allValues = new Set();
      rows.forEach((row) => {
        const value = row[fieldName];
        if (value) {
          value.split(",").forEach((part) => {
            const trimmedPart = part.trim();
            if (trimmedPart) allValues.add(trimmedPart);
          });
        }
      });
      return Array.from(allValues).sort();
    };

    const processJsonArrayField = (rows, fieldName) => {
      const allValues = new Set();
      rows.forEach((row) => {
        const value = row[fieldName];
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              parsed.forEach((item) => item && allValues.add(item.trim()));
            }
          } catch (e) {
            /* Ignorar si no es un JSON válido */
          }
        }
      });
      return Array.from(allValues).sort();
    };

    res.locals.recipeTitles = recipeRows.map((r) => r.name);
    res.locals.metadataOptions = {
      difficulties: processField(difficulties, "difficulty"),
      equipments: processField(equipments, "equipment"),
      mealTypes: processField(mealTypes, "meal_type"),
      cuisineTypes: processField(cuisineTypes, "cuisine_type"),
      tags: processJsonArrayField(tags, "tags"),
    };
  } catch (error) {
    console.error("Error fetching layout data:", error);
    console.error("Error fetching recipe titles for layout:", error);
    res.locals.recipeTitles = [];
    res.locals.metadataOptions = {
      difficulties: [],
      equipments: [],
      mealTypes: [],
      cuisineTypes: [],
      tags: [],
    };
  }
  next();
});

// Salud ligera para Docker/K8s: no toca la DB pesada como hace "/".
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", env: env.nodeEnv });
});

// Ruta para evitar el error 404 del favicon en las logs del navegador
app.get("/favicon.ico", (req, res) => res.status(204).send());

// Middleware dinámico para servir imágenes desde la carpeta configurada en la base de datos.
// Se activa solo para las rutas que comienzan con /images.
app.use("/images", async (req, res, next) => {
  try {
    const imageFolderSetting = await dbGet("SELECT value FROM unit_settings WHERE id = 'image_folder'");
    const imageFolder = imageFolderSetting ? imageFolderSetting.value : "_resources";
    const imageFolderPath = path.join(__dirname, imageFolder);
    // console.log(`[Static Middleware] Sirviendo desde: ${imageFolderPath} para la ruta ${req.path}`);

    // Creamos un middleware estático "al vuelo" y lo ejecutamos inmediatamente.
    // Esto es más eficiente que usar app.use() en cada petición.
    const staticMiddleware = express.static(imageFolderPath);
    staticMiddleware(req, res, next);
  } catch (error) {
    console.error("Error en el middleware de imágenes dinámicas:", error);
    // Si hay un error, simplemente pasamos al siguiente middleware,
    // lo que probablemente resultará en un 404 para la imagen.
    next(error);
  }
});

// Usar el enrutador principal
app.use("/", routes);

// 404 para API y vistas no encontradas
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "No encontrado." });
  }
  res.status(404).send("No encontrado.");
});

// Handler global: no filtrar stack al cliente en prod
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: "Error interno del servidor." });
  }
  res.status(500).send("Error interno del servidor.");
});

const httpServer = http.createServer(app);
const io = initSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`Aplicación de recetas escuchando en http://localhost:${port} (${env.nodeEnv})`);
});

// Cierre graceful para Docker stop/restart
const shutdown = (signal) => {
  console.log(`Recibido ${signal}, cerrando...`);
  httpServer.close(() => {
    db.close((err) => {
      if (err) console.error("Error al cerrar SQLite:", err);
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
