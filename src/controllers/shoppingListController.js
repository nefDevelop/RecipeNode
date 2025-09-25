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
const generateShoppingList = (req, res) => {
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

      // Obtener las categorías personalizadas de la base de datos
      db.all("SELECT lower(ingredient_name) as name, category FROM ingredient_categories", [], (catErr, categoryRows) => {
        if (catErr) return res.status(500).json({ error: catErr.message });
        const customCategories = categoryRows.reduce((acc, row) => {
          acc[row.name] = row.category;
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
              // Usar categoría personalizada si existe, si no la del parser, y si no "Otros"
              const category = customCategories[ing.name.toLowerCase()] || ing.category || "Otros";
              acc[key] = { name: ing.name, totalQuantity: 0, baseUnit: ing.baseUnit, category: category };
            }
            acc[key].totalQuantity += ing.quantity;
            return acc;
          }, {});

          const categorizedIngredients = {};
          Object.values(aggregated).forEach((ing) => {
            const category = ing.category;
            if (!categorizedIngredients[category]) {
              categorizedIngredients[category] = [];
            }
            // Formato del texto del ingrediente
            let displayString = `${ing.totalQuantity.toFixed(2).replace(/\.00$/, "")} ${ing.baseUnit} de ${ing.name}`;
            if (ing.baseUnit === "unidad") displayString = `${ing.totalQuantity} ${ing.name}${ing.totalQuantity > 1 ? "s" : ""}`;

            categorizedIngredients[category].push(displayString);
          });

          res.json({ ingredients: categorizedIngredients });
        });
      });
    });
  });
};

module.exports = { getManualList, addManualItem, updateManualItem, deleteManualItem, generateShoppingList, updateManualListOrder };
