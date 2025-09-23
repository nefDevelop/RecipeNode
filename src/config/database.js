const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "../../database.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Error al conectar a la base de datos:", err.message);
  }
  console.log("Conectado a la base de datos SQLite.");
});

module.exports = db;
