const fs = require("fs");
const fm = require("front-matter");
const db = require("../config/database");
const { parseIngredient, normalizeIngredient } = require("../utils/ingredientParser");
const { extractIngredients } = require("../utils/recipeUtils");
const { getIO } = require("../socket");

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

/**
 * Obtiene todos los artículos de la lista de la compra manual.
 */
const getManualList = async (req, res) => {
  try {
    const rows = await dbAll("SELECT id, text, checked, tab_id FROM manual_shopping_items ORDER BY order_index ASC");
    // Convertir 'checked' de 0/1 a booleano para el frontend
    const items = rows.map((item) => ({ ...item, checked: !!item.checked, tabId: item.tab_id }));
    res.json(items);
  } catch (error) {
    console.error("Error al obtener la lista manual:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Añade un nuevo artículo a la lista de la compra manual.
 */
const addManualItem = async (req, res) => {
  const { text, tabId } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "El texto del artículo es requerido." });
  }
  if (!tabId) {
    return res.status(400).json({ error: "El ID de la pestaña es requerido." });
  }

  try {
    // Para añadir el nuevo elemento al principio, incrementamos el order_index de todos los elementos existentes en la misma pestaña.
    await dbRun("BEGIN TRANSACTION");
    await dbRun("UPDATE manual_shopping_items SET order_index = order_index + 1 WHERE tab_id = ?", [tabId]);

    // Luego, insertamos el nuevo elemento con order_index = 0 en su pestaña.
    const sql = "INSERT INTO manual_shopping_items (text, order_index, tab_id) VALUES (?, 0, ?)";
    const result = await dbRun(sql, [text.trim(), tabId]);

    await dbRun("COMMIT");

    const newItem = {
      id: result.lastID,
      text: text.trim(),
      checked: false,
      order_index: 0,
      tabId: tabId,
    };
    getIO().emit("item:added", newItem);
    res.status(201).json(newItem);
  } catch (error) {
    await dbRun("ROLLBACK");
    console.error("Error al guardar el artículo manual:", error);
    return res.status(500).json({ error: "Error al guardar el artículo." });
  }
};

/**
 * Actualiza el estado (marcado/desmarcado) de un artículo.
 */
const updateManualItem = async (req, res) => {
  const { id } = req.params;
  const { checked } = req.body;

  if (typeof checked !== "boolean") {
    return res.status(400).json({ error: "El estado 'checked' debe ser un booleano." });
  }

  try {
    const sql = "UPDATE manual_shopping_items SET checked = ? WHERE id = ?";
    const result = await dbRun(sql, [checked ? 1 : 0, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Artículo no encontrado." });
    }
    const updatedItem = { id: id, checked: checked };
    getIO().emit("item:updated", updatedItem);
    res.status(200).json({ message: "Artículo actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar el artículo:", error);
    return res.status(500).json({ error: "Error al actualizar el artículo." });
  }
};

/**
 * Elimina un artículo de la lista de la compra manual.
 */
const deleteManualItem = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = "DELETE FROM manual_shopping_items WHERE id = ?";
    const result = await dbRun(sql, [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Artículo no encontrado." });
    }
    getIO().emit("item:deleted", { id: id });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error("Error al eliminar el artículo:", error);
    return res.status(500).json({ error: "Error al eliminar el artículo." });
  }
};

/**
 * Actualiza el orden de los artículos de la lista manual.
 */
const updateManualListOrder = async (req, res) => {
  const { orderedIds, tabId } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "Se esperaba un array de IDs." });
  }
  if (!tabId) {
    return res.status(400).json({ error: "El ID de la pestaña es requerido." });
  }

  // Usar una transacción para asegurar la atomicidad
  try {
    await dbRun("BEGIN TRANSACTION");
    const updatePromises = orderedIds.map((id, index) =>
      dbRun("UPDATE manual_shopping_items SET order_index = ? WHERE id = ?", [index, id])
    );
    await Promise.all(updatePromises);
    await dbRun("COMMIT");

    getIO().emit("items:reordered", { orderedIds, tabId });
    res.status(200).json({ message: "Orden actualizado correctamente." });
  } catch (error) {
    await dbRun("ROLLBACK");
    console.error("Error al actualizar el orden:", error);
    return res.status(500).json({ error: "Error al guardar el nuevo orden." });
  }
};

/**
 * Normaliza el nombre de un ingrediente para una agrupación más inteligente.
 * - Convierte a minúsculas.
 * - Elimina contenido entre paréntesis.
 * - Intenta convertir plurales a singulares (de forma simple).
 * @param {string} name - El nombre del ingrediente.
 * @returns {string} - El nombre normalizado.
 */
const normalizeIngredientName = (name) => {
  let normalized = name.toLowerCase();
  // Eliminar texto entre paréntesis (ej. "Queso (sin lactosa)")
  normalized = normalized.replace(/\s*\(.*\)\s*/g, "").trim();

  // Reglas simples de singularización
  if (normalized.endsWith("es") && normalized.length > 3) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 2) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
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

    // 4. Read all ingredients from recipe files asynchronously
    const ingredientPromises = recipeNames.map(async (name) => {
      const recipePath = recipePathMap[name];
      if (!recipePath) return [];

      try {
        const fileContent = await fs.promises.readFile(recipePath, "utf8");
        const { body } = fm(fileContent);
        return extractIngredients(body);
      } catch (readErr) {
        console.error(`No se pudo leer el archivo de receta: ${recipePath}`, readErr);
        return []; // Return empty array on error to not break the flow
      }
    });
    const allIngredientsRaw = (await Promise.all(ingredientPromises)).flat();

    // 5. Normalize and aggregate ingredients
    const normalizedIngredients = allIngredientsRaw.map((ingStr) => normalizeIngredient(parseIngredient(ingStr), conversions));

    const aggregated = normalizedIngredients.reduce((acc, ing) => {
      const normalizedName = normalizeIngredientName(ing.name);
      // Create a key that differentiates between ingredients with and without quantity
      const key = ing.quantity === null ? `${normalizedName}|no_qty` : `${normalizedName}|${ing.baseUnit}`;

      if (!acc[key]) {
        acc[key] = {
          name: ing.name,
          baseUnit: ing.baseUnit,
          displayName: normalizedName,
          totalQuantity: ing.quantity === null ? 0 : ing.quantity, // Initialize with quantity or 0 if no quantity
          recipeCount: ing.quantity === null ? 1 : 0, // Initialize recipeCount if no quantity
        };
      } else {
        if (ing.quantity === null) {
          acc[key].recipeCount++;
        } else {
          acc[key].totalQuantity += ing.quantity;
        }
      }
      return acc;
    }, {});

    // 6. Filter out items with 0 quantity and 0 recipe count
    const filteredAggregated = Object.values(aggregated).filter((ing) => !(ing.totalQuantity === 0 && ing.recipeCount === 0));

    // 7. Format final list and sort alphabetically
    const finalList = filteredAggregated.map((ing) => {
      if (ing.recipeCount > 0) {
        // For ingredients without explicit quantity, show recipe count
        return `${ing.displayName} (${ing.recipeCount} recetas)`;
      } else {
        // For ingredients with quantity, use existing formatting
        const quantity = parseFloat(ing.totalQuantity.toFixed(2));
        const displayName = quantity > 1 ? `${ing.displayName}s` : ing.displayName;

        let displayString = `${quantity.toString().replace(/\.00$/, "")} ${ing.baseUnit} de ${displayName}`;
        if (ing.baseUnit === "unidad") displayString = `${quantity} ${displayName}`;
        return displayString;
      }
    });

    finalList.sort((a, b) => a.localeCompare(b));

    res.json({ ingredients: finalList });
  } catch (error) {
    console.error("Error al generar la lista de la compra:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = { getManualList, addManualItem, updateManualItem, deleteManualItem, generateShoppingList, updateManualListOrder };
