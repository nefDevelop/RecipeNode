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

  Promise.all([getTitles, getSettings])
    .then(([recipeTitles, settings]) => {
      return res.render("settings", {
        title: "Ajustes",
        settings,
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

module.exports = {
  getSettingsPage,
  updateSettings,
};
