const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const env = require("./env");

// DATA_DIR vive fuera del contenedor (volumen ./data:/app/data).
// Compat hacia atrás: si existe el database.db legacy en la raíz y aún no
// existe en data/, se reutiliza el legacy para no perder datos.
const dataDir = env.dataDir;
fs.mkdirSync(dataDir, { recursive: true });

const newPath = path.join(dataDir, "database.db");
const legacyPath = path.resolve(__dirname, "../../database.db");
let dbPath = newPath;
if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
  console.warn(`[db] Usando database legacy en ${legacyPath}. Mueve el fichero a ${newPath} cuando puedas.`);
  dbPath = legacyPath;
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Error al conectar a la base de datos:", err.message);
  }
  console.log("Conectado a la base de datos SQLite.");
});

module.exports = db;
