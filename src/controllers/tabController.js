const db = require("../config/database");
const { getIO } = require("../socket");

// --- Database Promise Wrappers ---
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

/**
 * Obtiene todas las pestañas de la lista de la compra.
 */
const getTabs = async (req, res) => {
  try {
    const tabs = await dbAll("SELECT id, name FROM shopping_list_tabs ORDER BY name ASC");
    res.json(tabs);
  } catch (error) {
    console.error("Error al obtener las pestañas:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

/**
 * Crea una nueva pestaña.
 */
const createTab = async (req, res) => {
  const { name } = req.body;
  const userId = req.session.userId;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "El nombre de la pestaña es requerido." });
  }

  try {
    const sql = "INSERT INTO shopping_list_tabs (name, user_id) VALUES (?, ?)";
    const result = await dbRun(sql, [name.trim(), userId]);
    const newTab = {
      id: result.lastID,
      name: name.trim(),
    };
    getIO().emit("tab:created", newTab);
    res.status(201).json(newTab);
  } catch (error) {
    console.error("Error al crear la pestaña:", error);
    res.status(500).json({ error: "Error al guardar la pestaña." });
  }
};

/**
 * Renombra una pestaña.
 */
const renameTab = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "El nuevo nombre de la pestaña es requerido." });
  }

  try {
    const sql = "UPDATE shopping_list_tabs SET name = ? WHERE id = ?";
    const result = await dbRun(sql, [name.trim(), id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Pestaña no encontrada." });
    }
    const updatedTab = { id: id, name: name.trim() };
    getIO().emit("tab:renamed", updatedTab);
    res.status(200).json({ message: "Pestaña renombrada correctamente." });
  } catch (error) {
    console.error("Error al renombrar la pestaña:", error);
    res.status(500).json({ error: "Error al renombrar la pestaña." });
  }
};

/**
 * Elimina una pestaña y todos sus artículos asociados.
 */
const deleteTab = async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("BEGIN TRANSACTION");
    // Eliminar los artículos asociados a la pestaña
    await dbRun("DELETE FROM manual_shopping_items WHERE tab_id = ?", [id]);
    // Eliminar la pestaña
    const result = await dbRun("DELETE FROM shopping_list_tabs WHERE id = ?", [id]);
    await dbRun("COMMIT");

    if (result.changes === 0) {
      // Si no se encontró la pestaña, la transacción se completa igual pero informamos al cliente.
      return res.status(404).json({ error: "Pestaña no encontrada." });
    }
    
    getIO().emit("tab:deleted", { id: id });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    await dbRun("ROLLBACK");
    console.error("Error al eliminar la pestaña:", error);
    res.status(500).json({ error: "Error al eliminar la pestaña." });
  }
};

/**
 * Obtiene los artículos asociados a una pestaña específica.
 * Útil para mostrar al usuario qué se va a eliminar.
 */
const getTabItems = async (req, res) => {
    const { id } = req.params;
    try {
        const items = await dbAll("SELECT id, text FROM manual_shopping_items WHERE tab_id = ?", [id]);
        res.json(items);
    } catch (error) {
        console.error("Error al obtener los artículos de la pestaña:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

module.exports = {
  getTabs,
  createTab,
  renameTab,
  deleteTab,
  getTabItems,
};
