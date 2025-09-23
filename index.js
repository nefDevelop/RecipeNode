const express = require("express");
const fs = require("fs");
const path = require("path");
const marked = require("marked");
const fm = require("front-matter");
const sqlite3 = require("sqlite3").verbose();
const { parseIngredient, normalizeIngredient } = require("./ingredient-parser.js");

const app = express();
const port = 3000;

// Conectar a la base de datos SQLite
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Conectado a la base de datos SQLite.");
});

// Crear tablas si no existen
function setupDatabase() {
  db.serialize(() => {
    // 1. Setup unit_settings table
    db.run(`CREATE TABLE IF NOT EXISTS unit_settings (id TEXT PRIMARY KEY, value REAL NOT NULL)`);
    const defaultUnits = [
      { id: "kg-to-g", value: 1000 },
      { id: "l-to-ml", value: 1000 },
      { id: "cup-to-ml", value: 240 },
      { id: "tbsp-to-ml", value: 15 },
      { id: "tsp-to-ml", value: 5 },
    ];
    const stmt = db.prepare("INSERT OR IGNORE INTO unit_settings (id, value) VALUES (?, ?)");
    defaultUnits.forEach((unit) => stmt.run(unit.id, unit.value));
    stmt.finalize();

    // 2. Check and migrate 'planning' table
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='planning'", (err, row) => {
      if (err) return console.error("Error al verificar el esquema de la tabla 'planning':", err);

      if (!row) {
        // Table doesn't exist, create it.
        db.run(
          `CREATE TABLE planning (date TEXT NOT NULL, meal_type TEXT NOT NULL, recipe_name TEXT NOT NULL, PRIMARY KEY (date, meal_type))`,
          () => console.log("Tabla 'planning' creada.")
        );
      } else {
        const tableHasMealType = row.sql.includes("meal_type");
        if (!tableHasMealType) {
          console.log("Detectada versión antigua de la tabla 'planning'. Migrando...");
          db.serialize(() => {
            db.run("BEGIN TRANSACTION;");
            db.run(
              "CREATE TABLE planning_new (date TEXT NOT NULL, meal_type TEXT NOT NULL, recipe_name TEXT NOT NULL, PRIMARY KEY (date, meal_type))"
            );
            db.run("INSERT INTO planning_new (date, meal_type, recipe_name) SELECT date, 'lunch', recipe_name FROM planning");
            db.run("DROP TABLE planning");
            db.run("ALTER TABLE planning_new RENAME TO planning");
            db.run("COMMIT;", (err) => {
              if (err) console.error("Error al completar la migración de la tabla 'planning':", err);
              else console.log("Migración de la tabla 'planning' completada.");
            });
          });
        }
      }
    });

    // 3. Recipes table and sync
    db.run(`CREATE TABLE IF NOT EXISTS recipes (name TEXT PRIMARY KEY, path TEXT NOT NULL)`, (err) => {
      if (err) return console.error("Error creando la tabla de recetas:", err);

      // Sync filesystem recipes to DB on startup
      try {
        const files = fs.readdirSync(recipesPath).filter((file) => path.extname(file) === ".md");
        const recipeNamesFromFS = files.map((file) => path.basename(file, ".md"));

        db.serialize(() => {
          const insertStmt = db.prepare("INSERT OR REPLACE INTO recipes (name, path) VALUES (?, ?)");
          files.forEach((file) => {
            const name = path.basename(file, ".md");
            const fullPath = path.join(recipesPath, file);
            insertStmt.run(name, fullPath);
          });
          insertStmt.finalize();

          if (recipeNamesFromFS.length > 0) {
            const placeholders = recipeNamesFromFS.map(() => "?").join(",");
            db.run(`DELETE FROM recipes WHERE name NOT IN (${placeholders})`, recipeNamesFromFS);
          } else {
            db.run(`DELETE FROM recipes`);
          }
          console.log(`Sincronizadas ${files.length} recetas con la base de datos.`);
        });
      } catch (e) {
        console.error("No se pudieron sincronizar las recetas desde el sistema de archivos:", e);
      }
    });
  });
}

setupDatabase();

// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use("/_resources", express.static(path.join(__dirname, "recetas/_resources")));
app.use("/attachment", express.static(path.join(__dirname, "recetas/attachment")));
app.use(express.json()); // Para parsear JSON en las peticiones API
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios

// Ruta para evitar el error 404 del favicon en las logs del navegador
app.get("/favicon.ico", (req, res) => res.status(204).send());

const recipesPath = path.join(__dirname, "recetas");

// Ruta principal: Muestra el buscador y una receta si se especifica
app.get("/", (req, res) => {
  db.all("SELECT name FROM recipes ORDER BY name", [], (err, recipeRows) => {
    if (err) {
      console.error("Error al cargar los títulos de las recetas:", err);
      return res.status(500).render("index", {
        recipeTitles: [],
        title: "Error",
        content: "No se pudo cargar la lista de recetas desde la base de datos.",
      });
    }
    const recipeTitles = recipeRows.map((r) => r.name);

    if (req.query.recipe) {
      const recipeName = req.query.recipe;
      db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, recipe) => {
        if (err) {
          console.error(`Error al buscar la receta ${recipeName}:`, err);
          return res.status(500).render("index", {
            recipeTitles,
            title: "Error",
            content: "Error al buscar la receta en la base de datos.",
          });
        }

        if (recipe) {
          try {
            const fileContent = fs.readFileSync(recipe.path, "utf8");
            const { attributes, body: rawBody } = fm(fileContent);
            const body = rawBody.replace(/%%.*?%%/g, "");
            let htmlContent = marked.parse(body);
            htmlContent = htmlContent.replace(/!\[\[(.*?)\|(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');
            htmlContent = htmlContent.replace(/!\[\[(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');

            return res.render("index", {
              title: attributes.title || recipeName,
              content: htmlContent,
              recipeTitles: recipeTitles,
            });
          } catch (readErr) {
            console.error(`Error al leer el archivo de receta ${recipe.path}:`, readErr);
            return res.status(500).render("index", {
              recipeTitles,
              title: "Error",
              content: "No se pudo leer el archivo de la receta.",
            });
          }
        } else {
          return res.render("index", {
            recipeTitles,
            title: "Receta no encontrada",
            content: `La receta "${recipeName}" no existe. Por favor, busca otra.`,
          });
        }
      });
    } else {
      res.render("index", {
        recipeTitles: recipeTitles,
      });
    }
  });
});

// Ruta para la página de ajustes
app.get("/settings", (req, res) => {
  db.all("SELECT id, value FROM unit_settings", [], (err, rows) => {
    if (err) {
      res.status(500).send("Error al cargar los ajustes.");
      return console.error(err.message);
    }
    const settings = rows.reduce((acc, row) => {
      acc[row.id] = row.value;
      return acc;
    }, {});
    res.render("settings", { settings });
  });
});

app.post("/settings", (req, res) => {
  const units = req.body;
  const stmt = db.prepare("UPDATE unit_settings SET value = ? WHERE id = ?");
  Object.entries(units).forEach(([id, value]) => {
    stmt.run(value, id);
  });
  stmt.finalize((err) => {
    if (err) {
      res.status(500).send("Error al guardar los ajustes.");
      return console.error(err.message);
    }
    res.redirect("/settings");
  });
});

// Ruta para la página de planificación
app.get("/planning", (req, res) => {
  db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error("Error al cargar los títulos de las recetas para la planificación:", err);
      return res.status(500).send("Error al cargar las recetas");
    }
    const recipeTitles = rows.map((r) => r.name);
    res.render("planning", { recipeTitles });
  });
});

// Ruta para la página de lista de la compra
app.get("/shopping-list", (req, res) => {
  // Esta página no necesita la lista completa de recetas para su vista inicial.
  // Se pasa un array vacío para mantener la consistencia si la plantilla lo espera.
  res.render("shopping-list", { recipeTitles: [] });
});

function extractIngredients(markdownBody) {
  const lines = markdownBody.split("\n");
  const ingredientHeaderKeywords = ["ingredientes", "ingredients"];

  let ingredientsSection = "";
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Check if the line is an ingredients header
    if (!inSection) {
      // Matches '# Ingredients', '## Ingredients', etc. or just 'Ingredients' on its own line
      const isHeader = lowerLine.startsWith("#") && ingredientHeaderKeywords.some((keyword) => lowerLine.includes(keyword));
      const isPlainTextHeader = ingredientHeaderKeywords.includes(lowerLine);

      if (isHeader || isPlainTextHeader) {
        inSection = true;
        // Don't add the header itself, start from the next line
        continue;
      }
    }

    if (inSection) {
      // If we find the next header, stop collecting.
      if (line.startsWith("#")) {
        break;
      }
      // Add the line to our section to be parsed later
      ingredientsSection += lines[i] + "\n"; // Use original line to preserve indentation for regex
    }
  }

  if (!ingredientsSection) {
    return [];
  }

  // Now parse the collected section for list items
  const ingredients = [];
  const listItemRegex = /^\s*-\s(?:\[[ x]\]\s)?(.*)/gm;
  let match;
  while ((match = listItemRegex.exec(ingredientsSection)) !== null) {
    const ingredient = match[1].trim();
    if (ingredient) {
      ingredients.push(ingredient);
    }
  }
  return ingredients;
}

// API para generar lista de la compra
app.get("/api/shopping-list", (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren fechas de inicio y fin." });
  }

  // 1. Get all planned recipes, including duplicates
  const sql = `SELECT recipe_name FROM planning WHERE date >= ? AND date <= ?`;

  db.all(sql, [startDate, endDate], (err, plannedMeals) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (plannedMeals.length === 0) {
      return res.json([]);
    }

    const recipeNames = plannedMeals.map((r) => r.recipe_name);
    const uniqueRecipeNames = [...new Set(recipeNames)];

    if (uniqueRecipeNames.length === 0) {
      return res.json([]);
    }

    // 2. Get paths for the unique recipes
    const placeholders = uniqueRecipeNames.map(() => "?").join(",");
    const pathSql = `SELECT name, path FROM recipes WHERE name IN (${placeholders})`;

    db.all(pathSql, uniqueRecipeNames, (pathErr, recipeDetails) => {
      if (pathErr) {
        return res.status(500).json({ error: pathErr.message });
      }

      // 3. Create a map for easy path lookup
      const recipePathMap = recipeDetails.reduce((acc, row) => {
        acc[row.name] = row.path;
        return acc;
      }, {});

      db.all("SELECT id, value FROM unit_settings", [], (settingErr, settingRows) => {
        if (settingErr) {
          return res.status(500).json({ error: settingErr.message });
        }
        const conversions = settingRows.reduce((acc, row) => {
          acc[row.id] = row.value;
          return acc;
        }, {});

        const allIngredientsRaw = [];
        recipeNames.forEach((name) => {
          const recipePath = recipePathMap[name];
          if (recipePath) {
            try {
              const fileContent = fs.readFileSync(recipePath, "utf8");
              const { body } = fm(fileContent);
              const ingredients = extractIngredients(body);
              allIngredientsRaw.push(...ingredients);
            } catch (readErr) {
              console.error(`No se pudo leer el archivo de receta: ${recipePath}`, readErr);
            }
          }
        });

        const normalizedIngredients = allIngredientsRaw.map((ingStr) => {
          const parsed = parseIngredient(ingStr);
          return normalizeIngredient(parsed, conversions);
        });

        const aggregated = normalizedIngredients.reduce((acc, ing) => {
          const key = `${ing.name.toLowerCase()}|${ing.baseUnit}`;
          if (!acc[key]) {
            acc[key] = { name: ing.name, totalQuantity: 0, baseUnit: ing.baseUnit };
          }
          acc[key].totalQuantity += ing.quantity;
          return acc;
        }, {});

        const formattedList = Object.values(aggregated).map((ing) => {
          let displayQuantity = ing.totalQuantity;
          let displayUnit = ing.baseUnit;

          if (ing.baseUnit === "g" && ing.totalQuantity >= 1000) {
            displayQuantity = ing.totalQuantity / (conversions["kg-to-g"] || 1000);
            displayUnit = "kg";
          } else if (ing.baseUnit === "ml" && ing.totalQuantity >= 1000) {
            displayQuantity = ing.totalQuantity / (conversions["l-to-ml"] || 1000);
            displayUnit = "l";
          }

          if (displayQuantity % 1 !== 0) {
            displayQuantity = parseFloat(displayQuantity.toFixed(2));
          }

          let displayString;
          if (ing.baseUnit === "unidad") {
            const pluralSuffix = displayQuantity > 1 ? (ing.name.endsWith("l") || ing.name.endsWith("n") ? "es" : "s") : "";
            displayString = `${displayQuantity} ${ing.name}${pluralSuffix}`;
          } else {
            displayString = `${displayQuantity} ${displayUnit} de ${ing.name}`;
          }

          return { name: ing.name, display: displayString };
        });

        res.json(formattedList);
      });
    });
  });
});

// API para obtener los eventos del calendario
app.get("/api/planning", (req, res) => {
  db.all("SELECT date, meal_type, recipe_name FROM planning", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const plans = rows.reduce((acc, row) => {
      if (!acc[row.date]) {
        acc[row.date] = {};
      }
      acc[row.date][row.meal_type] = row.recipe_name;
      return acc;
    }, {});
    res.json(plans);
  });
});

// API para guardar un evento en el calendario
app.post("/api/planning", (req, res) => {
  const { date, meal_type, recipe_name } = req.body;

  if (!date || !meal_type) {
    return res.status(400).json({ error: "Date and meal_type are required." });
  }

  // Si recipe_name está vacío, eliminamos la entrada.
  if (!recipe_name) {
    const stmt = db.prepare("DELETE FROM planning WHERE date = ? AND meal_type = ?");
    stmt.run(date, meal_type, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Plan eliminado con éxito!" });
    });
    stmt.finalize();
  } else {
    // Si no, insertamos o reemplazamos la entrada.
    const stmt = db.prepare("INSERT OR REPLACE INTO planning (date, meal_type, recipe_name) VALUES (?, ?, ?)");
    stmt.run(date, meal_type, recipe_name, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Plan guardado con éxito!" });
    });
    stmt.finalize();
  }
});

app.listen(port, () => {
  console.log(`Aplicación de recetas escuchando en http://localhost:${port}`);
});
