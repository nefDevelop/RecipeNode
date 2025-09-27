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
    const rows = await dbAll("SELECT date, meal_type, recipe_name FROM planning ORDER BY CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 ELSE 4 END");
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

const generatePlanningList = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren fechas de inicio y fin." });
  }

  try {
    const plannedMeals = await dbAll(
      `SELECT date, meal_type, recipe_name 
       FROM planning 
       WHERE date >= ? AND date <= ? 
       ORDER BY date, meal_type`,
      [startDate, endDate]
    );

    if (plannedMeals.length === 0) {
      return res.json({ html: "<p>No hay comidas planificadas en este período.</p>" });
    }

    const mealsByDate = plannedMeals.reduce((acc, meal) => {
      if (!acc[meal.date]) {
        acc[meal.date] = [];
      }
      acc[meal.date].push(meal);
      return acc;
    }, {});

    let html = "<ul>";
    for (const date in mealsByDate) {
      const dateObj = new Date(date + 'T00:00:00');
      const dateString = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      html += `<li><strong>${dateString}</strong><ul>`;
      mealsByDate[date].forEach(meal => {
        const mealTypeMap = {
          breakfast: 'Desayuno',
          lunch: 'Almuerzo',
          dinner: 'Cena',
        };
        const mealType = mealTypeMap[meal.meal_type] || (meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1));
        html += `<li>${mealType}: ${meal.recipe_name}</li>`;
      });
      html += "</ul></li>";
    }
    html += "</ul>";

    res.json({ html });
  } catch (error) {
    console.error("Error al generar la lista de planificación:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = {
  getPlanningPage,
  getPlanningData,
  savePlanningData,
  generatePlanningList,
};
