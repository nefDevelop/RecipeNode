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
  const units = req.body;
  try {
    // Usamos Promise.all para ejecutar todas las actualizaciones en paralelo
    const updatePromises = Object.entries(units).map(([id, value]) => {
      return dbRun("UPDATE unit_settings SET value = ? WHERE id = ?", [value, id]);
    });
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
