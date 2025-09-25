const db = require("../config/database");

// Muestra la página de ajustes con las configuraciones de unidades y categorías.
const getSettingsPage = (req, res) => {
  // Promise to get recipe titles
  const getTitles = new Promise((resolve, reject) => {
    db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => r.name));
    });
  });

  // Promise to get settings
  const getSettings = new Promise((resolve, reject) => {
    db.all("SELECT id, value FROM unit_settings", [], (err, rows) => {
      if (err) return reject(err);
      const settings = rows.reduce((acc, row) => {
        acc[row.id] = row.value;
        return acc;
      }, {});
      resolve(settings);
    });
  });

  // Promise to get ingredient category mappings
  const getCategoryMappings = new Promise((resolve, reject) => {
    db.all("SELECT ingredient_name, category FROM ingredient_categories ORDER BY category, ingredient_name", [], (err, rows) => {
      if (err) return reject(err);
      // Agrupar por categoría para una mejor visualización
      const mappings = rows.reduce((acc, row) => {
        (acc[row.category] = acc[row.category] || []).push(row.ingredient_name);
        return acc;
      }, {});
      resolve(mappings);
    });
  });

  Promise.all([getTitles, getSettings, getCategoryMappings])
    .then(([recipeTitles, settings, categoryMappings]) => {
      return res.render("settings", {
        title: "Ajustes",
        settings,
        categoryMappings,
        recipeTitles,
        user: req.session,
      });
    })
    .catch((err) => {
      console.error("Error al cargar la página de ajustes:", err);
      return res.status(500).send("Error al cargar la página de ajustes.");
    });
};

// Actualiza las conversiones de unidades.
const updateSettings = (req, res) => {
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
};

// Añade o actualiza la categoría de un ingrediente.
const updateIngredientCategory = (req, res) => {
  const { ingredient_name, category } = req.body;

  if (!ingredient_name || !category) {
    return res.status(400).json({ error: "El nombre del ingrediente y la categoría son requeridos." });
  }

  // Usamos INSERT OR REPLACE para simplificar: si el ingrediente ya existe, actualiza su categoría.
  const sql = "INSERT OR REPLACE INTO ingredient_categories (ingredient_name, category) VALUES (?, ?)";
  db.run(sql, [ingredient_name.trim().toLowerCase(), category.trim()], function (err) {
    if (err) {
      console.error("Error al guardar la categoría del ingrediente:", err);
      return res.status(500).json({ error: "Error al guardar la categoría." });
    }
    res.status(200).json({ message: "Categoría guardada correctamente." });
  });
};

module.exports = {
  getSettingsPage,
  updateSettings,
  updateIngredientCategory,
};
