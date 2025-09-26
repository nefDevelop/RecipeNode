const fs = require("fs");
const fm = require("front-matter");
const db = require("../config/database");
const { parseIngredient, normalizeIngredient } = require("../utils/ingredientParser");
const { extractIngredients } = require("../utils/recipeUtils");

/**
 * Obtiene todos los artículos de la lista de la compra manual.
 */
const getManualList = (req, res) => {
  db.all("SELECT id, text, checked FROM manual_shopping_items ORDER BY order_index ASC", [], (err, rows) => {
    if (err) {
      console.error("Error al obtener la lista manual:", err);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
    // Convertir 'checked' de 0/1 a booleano para el frontend
    const items = rows.map((item) => ({ ...item, checked: !!item.checked }));
    res.json(items);
  });
};

/**
 * Añade un nuevo artículo a la lista de la compra manual.
 */
const addManualItem = (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "El texto del artículo es requerido." });
  }

  // Primero, obtenemos el índice de orden más alto para asignar al nuevo elemento.
  db.get("SELECT MAX(order_index) as max_order FROM manual_shopping_items", [], (err, row) => {
    if (err) {
      console.error("Error al obtener el índice de orden máximo:", err);
      return res.status(500).json({ error: "Error al guardar el artículo." });
    }

    const newOrderIndex = row && row.max_order !== null ? row.max_order + 1 : 0;

    const sql = "INSERT INTO manual_shopping_items (text, order_index) VALUES (?, ?)";
    db.run(sql, [text.trim(), newOrderIndex], function (err) {
      if (err) {
        console.error("Error al añadir artículo a la lista manual:", err);
        return res.status(500).json({ error: "Error al guardar el artículo." });
      }
      res.status(201).json({
        id: this.lastID,
        text: text.trim(),
        checked: false,
      });
    });
  });
};

/**
 * Actualiza el estado (marcado/desmarcado) de un artículo.
 */
const updateManualItem = (req, res) => {
  const { id } = req.params;
  const { checked } = req.body;

  if (typeof checked !== "boolean") {
    return res.status(400).json({ error: "El estado 'checked' debe ser un booleano." });
  }

  const sql = "UPDATE manual_shopping_items SET checked = ? WHERE id = ?";
  db.run(sql, [checked ? 1 : 0, id], function (err) {
    if (err) {
      console.error("Error al actualizar el artículo:", err);
      return res.status(500).json({ error: "Error al actualizar el artículo." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Artículo no encontrado." });
    }
    res.status(200).json({ message: "Artículo actualizado correctamente." });
  });
};

/**
 * Elimina un artículo de la lista de la compra manual.
 */
const deleteManualItem = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM manual_shopping_items WHERE id = ?";
  db.run(sql, [id], function (err) {
    if (err) {
      console.error("Error al eliminar el artículo:", err);
      return res.status(500).json({ error: "Error al eliminar el artículo." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Artículo no encontrado." });
    }
    res.status(204).send(); // 204 No Content
  });
};

/**
 * Actualiza el orden de los artículos de la lista manual.
 */
const updateManualListOrder = (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "Se esperaba un array de IDs." });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("UPDATE manual_shopping_items SET order_index = ? WHERE id = ?");

    orderedIds.forEach((id, index) => {
      stmt.run(index, id);
    });

    stmt.finalize((err) => {
      if (err) {
        db.run("ROLLBACK");
        console.error("Error al actualizar el orden:", err);
        return res.status(500).json({ error: "Error al guardar el nuevo orden." });
      }
      db.run("COMMIT");
      res.status(200).json({ message: "Orden actualizado correctamente." });
    });
  });
};

/**
 * Genera una lista de la compra a partir de las recetas planificadas en un rango de fechas.
 */
const generateShoppingList = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren fechas de inicio y fin." });
  }

  try {
    // Promisify db.all
    const dbAll = (sql, params) =>
      new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

    // 1. Get planned meals
    const plannedMeals = await dbAll(`SELECT recipe_name FROM planning WHERE date >= ? AND date <= ?`, [startDate, endDate]);
    if (plannedMeals.length === 0) return res.json({ ingredients: [] });

    // 2. Get unique recipe paths
    const recipeNames = plannedMeals.map((r) => r.recipe_name);
    const uniqueRecipeNames = [...new Set(recipeNames)];
    if (uniqueRecipeNames.length === 0) return res.json({ ingredients: [] });
    const placeholders = uniqueRecipeNames.map(() => "?").join(",");
    const recipeDetails = await dbAll(`SELECT name, path FROM recipes WHERE name IN (${placeholders})`, uniqueRecipeNames);
    const recipePathMap = recipeDetails.reduce((acc, row) => ({ ...acc, [row.name]: row.path }), {});

    // 3. Get unit conversions
    const settingRows = await dbAll("SELECT id, value FROM unit_settings", []);
    const conversions = settingRows.reduce((acc, row) => ({ ...acc, [row.id]: row.value }), {});

    // 4. Read all ingredients from recipe files
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

    // 5. Normalize and aggregate ingredients
    const normalizedIngredients = allIngredientsRaw.map((ingStr) => normalizeIngredient(parseIngredient(ingStr), conversions));

    const aggregated = normalizedIngredients.reduce((acc, ing) => {
      const key = `${ing.name.toLowerCase()}|${ing.baseUnit}`;
      if (!acc[key]) {
        acc[key] = { name: ing.name, totalQuantity: 0, baseUnit: ing.baseUnit };
      }
      acc[key].totalQuantity += ing.quantity;
      return acc;
    }, {});

    // 6. Format final list and sort alphabetically
    const finalList = Object.values(aggregated).map((ing) => {
      let displayString = `${ing.totalQuantity.toFixed(2).replace(/\.00$/, "")} ${ing.baseUnit} de ${ing.name}`;
      if (ing.baseUnit === "unidad") displayString = `${ing.totalQuantity} ${ing.name}${ing.totalQuantity > 1 ? "s" : ""}`;
      return displayString;
    });

    finalList.sort((a, b) => a.localeCompare(b));

    res.json({ ingredients: finalList });
  } catch (error) {
    console.error("Error al generar la lista de la compra:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = { getManualList, addManualItem, updateManualItem, deleteManualItem, generateShoppingList, updateManualListOrder };
