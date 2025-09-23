const db = require("../config/database");

const getSettingsPage = (req, res) => {
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
};

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
