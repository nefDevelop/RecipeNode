const fs = require("fs");
const fm = require("front-matter");
const db = require("../config/database");
const { parseIngredient, normalizeIngredient } = require("../utils/ingredientParser");
const { extractIngredients } = require("../utils/recipeUtils");

const getPlanningPage = (req, res) => {
  db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error("Error al cargar los títulos de las recetas para la planificación:", err);
      return res.status(500).send("Error al cargar las recetas");
    }
    const recipeTitles = rows.map((r) => r.name);
    res.render("planning", { recipeTitles });
  });
};

const getPlanningData = (req, res) => {
  db.all("SELECT date, meal_type, recipe_name FROM planning", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Transform the rows into the format FullCalendar expects: an array of event objects.
    const events = rows.map((row) => {
      let backgroundColor = "#3498db"; // Default color
      if (row.meal_type === "breakfast") backgroundColor = "#f39c12"; // Orange for breakfast
      if (row.meal_type === "lunch") backgroundColor = "#2ecc71"; // Green for lunch
      if (row.meal_type === "dinner") backgroundColor = "#e74c3c"; // Red for dinner

      return {
        title: row.recipe_name,
        start: row.date,
        allDay: true,
        extendedProps: {
          meal_type: row.meal_type,
        },
        backgroundColor: backgroundColor,
        borderColor: backgroundColor,
      };
    });
    res.json(events);
  });
};

const savePlanningData = (req, res) => {
  const { date, meal_type, recipe_name } = req.body;

  if (!date || !meal_type) {
    return res.status(400).json({ error: "Date and meal_type are required." });
  }

  if (!recipe_name) {
    const stmt = db.prepare("DELETE FROM planning WHERE date = ? AND meal_type = ?");
    stmt.run(date, meal_type, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Plan eliminado con éxito!" });
    });
    stmt.finalize();
  } else {
    const stmt = db.prepare("INSERT OR REPLACE INTO planning (date, meal_type, recipe_name) VALUES (?, ?, ?)");
    stmt.run(date, meal_type, recipe_name, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Plan guardado con éxito!" });
    });
    stmt.finalize();
  }
};

const getShoppingListApi = (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren fechas de inicio y fin." });
  }

  const sql = `SELECT recipe_name FROM planning WHERE date >= ? AND date <= ?`;

  db.all(sql, [startDate, endDate], (err, plannedMeals) => {
    if (err) return res.status(500).json({ error: err.message });
    if (plannedMeals.length === 0) return res.json({ ingredients: {} });

    const recipeNames = plannedMeals.map((r) => r.recipe_name);
    const uniqueRecipeNames = [...new Set(recipeNames)];
    if (uniqueRecipeNames.length === 0) return res.json({ ingredients: {} });

    const placeholders = uniqueRecipeNames.map(() => "?").join(",");
    const pathSql = `SELECT name, path FROM recipes WHERE name IN (${placeholders})`;

    db.all(pathSql, uniqueRecipeNames, (pathErr, recipeDetails) => {
      if (pathErr) return res.status(500).json({ error: pathErr.message });

      const recipePathMap = recipeDetails.reduce((acc, row) => {
        acc[row.name] = row.path;
        return acc;
      }, {});

      db.all("SELECT id, value FROM unit_settings", [], (settingErr, settingRows) => {
        if (settingErr) return res.status(500).json({ error: settingErr.message });
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

          return displayString;
        });

        // Agrupamos todos los ingredientes bajo una única categoría para que coincida
        // con el formato que espera el frontend.
        const categorizedIngredients = {};
        if (formattedList.length > 0) {
          categorizedIngredients["Ingredientes"] = formattedList;
        }

        res.json({ ingredients: categorizedIngredients });
      });
    });
  });
};

module.exports = {
  getPlanningPage,
  getPlanningData,
  savePlanningData,
  getShoppingListApi,
};
