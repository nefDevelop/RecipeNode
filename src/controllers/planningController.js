const db = require("../config/database");

const getPlanningPage = (req, res) => {
  // Pasamos una variable booleana 'isAuthenticated' a la plantilla.
  // Esto hace que la lógica en el frontend sea más limpia y segura.
  const isAuthenticated = !!(req.session && req.session.userId);

  // recipeTitles es proporcionado por el middleware global
  res.render("planning", { title: "Planificación", user: req.session, isAuthenticated: isAuthenticated });
};

const getPlanningData = (req, res) => {
  // Si el usuario no está logueado, devolvemos un array vacío para que el calendario no muestre nada.
  if (!req.session || !req.session.userId) {
    return res.json([]);
  }

  db.all("SELECT date, meal_type, recipe_name FROM planning", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Transform the rows into the format FullCalendar expects: an array of event objects.
    const events = rows.map((row) => {
      let backgroundColor = "#3498db"; // Default color
      // Establecer un color de fondo uniforme para todos los eventos del calendario
      backgroundColor = "#d1fae5"; // Tailwind green-100
      return {
        title: row.recipe_name,
        start: row.date,
        allDay: true,
        extendedProps: {
          meal_type: row.meal_type,
        },
        backgroundColor: backgroundColor,
        borderColor: backgroundColor,
        textColor: "#064e3b", // Tailwind green-900 para un buen contraste
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

module.exports = {
  getPlanningPage,
  getPlanningData,
  savePlanningData,
};
