const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

function setupDatabase(db, recipesPath) {
  db.serialize(() => {
    // 1. Setup unit_settings table
    db.run(`CREATE TABLE IF NOT EXISTS unit_settings (id TEXT PRIMARY KEY, value REAL NOT NULL)`);
    // Crear la tabla para la lista de la compra manual compartida
    db.run(`
      CREATE TABLE IF NOT EXISTS manual_shopping_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        checked INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const defaultUnits = [
      { id: "kg-to-g", value: 1000 },
      { id: "l-to-ml", value: 1000 },
      { id: "cup-to-ml", value: 240 },
      { id: "tbsp-to-ml", value: 15 },
      { id: "tsp-to-ml", value: 5 },
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO unit_settings (id, value) VALUES (?, ?)");
    defaultUnits.forEach((unit) => stmt.run(unit.id, unit.value));
    stmt.finalize();

    // 2. Check and migrate 'planning' table
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='planning'", (err, row) => {
      if (err) return console.error("Error al verificar el esquema de la tabla 'planning':", err);

      if (!row) {
        // Table doesn't exist, create it.
        db.run(
          `CREATE TABLE planning (date TEXT NOT NULL, meal_type TEXT NOT NULL, recipe_name TEXT NOT NULL, PRIMARY KEY (date, meal_type))`,
          () => console.log("Tabla 'planning' creada.")
        );
      } else {
        const tableHasMealType = row.sql.includes("meal_type");
        if (!tableHasMealType) {
          console.log("Detectada versión antigua de la tabla 'planning'. Migrando...");
          db.serialize(() => {
            db.run("BEGIN TRANSACTION;");
            db.run(
              "CREATE TABLE planning_new (date TEXT NOT NULL, meal_type TEXT NOT NULL, recipe_name TEXT NOT NULL, PRIMARY KEY (date, meal_type))"
            );
            db.run("INSERT INTO planning_new (date, meal_type, recipe_name) SELECT date, 'lunch', recipe_name FROM planning");
            db.run("DROP TABLE planning");
            db.run("ALTER TABLE planning_new RENAME TO planning");
            db.run("COMMIT;", (err) => {
              if (err) console.error("Error al completar la migración de la tabla 'planning':", err);
              else console.log("Migración de la tabla 'planning' completada.");
            });
          });
        }
      }
    });

    // 3. Recipes table and sync
    db.run(`CREATE TABLE IF NOT EXISTS recipes (name TEXT PRIMARY KEY, path TEXT NOT NULL)`, (err) => {
      if (err) return console.error("Error creando la tabla de recetas:", err);

      // Sync filesystem recipes to DB on startup
      try {
        const files = fs.readdirSync(recipesPath).filter((file) => path.extname(file) === ".md");
        const recipeNamesFromFS = files.map((file) => path.basename(file, ".md"));

        db.serialize(() => {
          const insertStmt = db.prepare("INSERT OR REPLACE INTO recipes (name, path) VALUES (?, ?)");
          files.forEach((file) => {
            const name = path.basename(file, ".md");
            const fullPath = path.join(recipesPath, file);
            insertStmt.run(name, fullPath);
          });
          insertStmt.finalize();

          if (recipeNamesFromFS.length > 0) {
            const placeholders = recipeNamesFromFS.map(() => "?").join(",");
            db.run(`DELETE FROM recipes WHERE name NOT IN (${placeholders})`, recipeNamesFromFS);
          } else {
            db.run(`DELETE FROM recipes`);
          }
          console.log(`Sincronizadas ${files.length} recetas con la base de datos.`);
        });
      } catch (e) {
        console.error("No se pudieron sincronizar las recetas desde el sistema de archivos:", e);
      }
    });

    // 4. Users table and admin creation
    db.run(
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user')`,
      (err) => {
        if (err) return console.error("Error creando la tabla de usuarios:", err);

        const saltRounds = 10;
        const adminPassword = "admin123"; // Consider moving to an environment variable
        bcrypt.hash(adminPassword, saltRounds, (hashErr, hash) => {
          if (hashErr) return console.error("Error hasheando la contraseña del admin:", hashErr);

          const adminStmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)");
          adminStmt.run("admin", hash, "admin", () => console.log("Usuario administrador asegurado."));
          adminStmt.finalize();
        });
      }
    );
  });
}

module.exports = { setupDatabase };
