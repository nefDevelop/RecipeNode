const db = require("../config/database");

// --- Database Promise Wrappers ---
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, (err) => (err ? reject(err) : resolve())));

// Muestra la página de ajustes con las configuraciones de unidades y categorías.
const getSettingsPage = async (req, res) => {
  try {
    const recipeTitleRows = await dbAll("SELECT name FROM recipes ORDER BY name");
    const recipeTitles = recipeTitleRows.map((r) => r.name);

    const settingsRows = await dbAll("SELECT id, value FROM unit_settings");
    const settings = settingsRows.reduce((acc, row) => {
      acc[row.id] = row.value;
      return acc;
    }, {});

    // Fetch recipe card display settings or provide defaults
    let recipeCardDisplaySettings = await dbAll("SELECT value FROM unit_settings WHERE id = 'recipe_card_display_fields'");
    if (recipeCardDisplaySettings.length > 0) {
      settings.recipe_card_display_fields = JSON.parse(recipeCardDisplaySettings[0].value);
    } else {
      // Default display settings
      settings.recipe_card_display_fields = {
        image: true,
        name: true,
        difficulty: true,
        cookingTime: true,
        tags: true,
        mainIngredient: true,
      };
    }

    return res.render("settings", {
      title: "Ajustes",
      settings,
      recipeTitles,
      user: req.session,
    });
  } catch (error) {
    console.error("Error al cargar la página de ajustes:", error);
    return res.status(500).send("Error al cargar la página de ajustes.");
  }
};

// Actualiza las conversiones de unidades.
const updateSettings = async (req, res) => {
  const { ...otherSettings } = req.body; // Capture all other settings
  try {
    const updatePromises = [];

    // Handle unit settings (existing logic)
    for (const id in otherSettings) {
      // Exclude recipe_card_display_fields from otherSettings processing
      if (id.startsWith('recipe_card_display_fields[')) {
        continue;
      }
      updatePromises.push(dbRun("UPDATE unit_settings SET value = ? WHERE id = ?", [otherSettings[id], id]));
    }

    // Handle recipe card display settings
    const recipeCardDisplayFieldsFromForm = req.body.recipe_card_display_fields || {};
    const allPossibleDisplayFields = [
      'image', 'name', 'difficulty', 'cookingTime', 'tags', 'mainIngredient'
    ];
    const finalRecipeCardDisplaySettings = {};
    allPossibleDisplayFields.forEach(field => {
      finalRecipeCardDisplaySettings[field] = !!recipeCardDisplayFieldsFromForm[field]; // Convert to boolean
    });

    updatePromises.push(
      dbRun(
        "INSERT OR REPLACE INTO unit_settings (id, value) VALUES (?, ?)",
        ["recipe_card_display_fields", JSON.stringify(finalRecipeCardDisplaySettings)]
      )
    );

    await Promise.all(updatePromises);
    res.redirect("/settings");
  } catch (error) {
    console.error("Error al guardar los ajustes:", error.message);
    res.status(500).send("Error al guardar los ajustes.");
  }
};

module.exports = {
  getSettingsPage,
  updateSettings,
};
