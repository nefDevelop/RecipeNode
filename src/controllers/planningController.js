const db = require("../config/database");

// --- Database Promise Wrappers ---
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

const getPlanningPage = (req, res) => {
  // Pasamos una variable booleana 'isAuthenticated' a la plantilla.
  // Esto hace que la lógica en el frontend sea más limpia y segura.
  const isAuthenticated = !!(req.session && req.session.userId);

  // recipeTitles es proporcionado por el middleware global
  res.render("planning", { title: "Planificación", user: req.session, isAuthenticated: isAuthenticated });
};

const getPlanningData = async (req, res) => {
  // Si el usuario no está logueado, devolvemos un array vacío para que el calendario no muestre nada.
  if (!req.session || !req.session.userId) {
    return res.json([]);
  }

  try {
    const rows = await dbAll("SELECT date, meal_type, recipe_name FROM planning");
    // Transform the rows into the format FullCalendar expects: an array of event objects.
    const events = rows.map((row) => {
      // Establecer un color de fondo uniforme para todos los eventos del calendario
      const backgroundColor = "#d1fae5"; // Tailwind green-100
      return {
        title: row.recipe_name,
        start: row.date,
        allDay: true,
        extendedProps: { meal_type: row.meal_type },
        backgroundColor: backgroundColor,
        borderColor: backgroundColor,
        textColor: "#064e3b", // Tailwind green-900 para un buen contraste
      };
    });
    res.json(events);
  } catch (error) {
    console.error("Error fetching planning data:", error);
    return res.status(500).json({ error: error.message });
  }
};

const savePlanningData = async (req, res) => {
  const { date, meal_type, recipe_name } = req.body;

  if (!date || !meal_type) {
    return res.status(400).json({ error: "Date and meal_type are required." });
  }

  try {
    if (!recipe_name) {
      await dbRun("DELETE FROM planning WHERE date = ? AND meal_type = ?", [date, meal_type]);
      res.json({ message: "Plan eliminado con éxito!" });
    } else {
      await dbRun("INSERT OR REPLACE INTO planning (date, meal_type, recipe_name) VALUES (?, ?, ?)", [date, meal_type, recipe_name]);
      res.json({ message: "Plan guardado con éxito!" });
    }
  } catch (error) {
    console.error("Error saving planning data:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPlanningPage,
  getPlanningData,
  savePlanningData,
};
