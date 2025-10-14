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

    // Crear tabla para las pestañas de la lista de la compra
    db.run(`
      CREATE TABLE IF NOT EXISTS shopping_list_tabs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Añadir columna tab_id a la tabla de items
    db.run(`ALTER TABLE manual_shopping_items ADD COLUMN tab_id INTEGER`, (alterErr) => {
      if (alterErr && !alterErr.message.includes("duplicate column name")) {
        console.error("Error adding tab_id column to manual_shopping_items:", alterErr);
      } else if (!alterErr) {
        console.log("Added tab_id column to manual_shopping_items table.");
      }
    });

    // Añadir columna order_index a la tabla de items
    db.run(`ALTER TABLE manual_shopping_items ADD COLUMN order_index INTEGER DEFAULT 0`, (alterErr) => {
      if (alterErr && !alterErr.message.includes("duplicate column name")) {
        console.error("Error adding order_index column to manual_shopping_items:", alterErr);
      } else if (!alterErr) {
        console.log("Added order_index column to manual_shopping_items table.");
      }
    });
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

      // Add cooking_time column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN cooking_time INTEGER`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding cooking_time column:", alterErr);
        } else if (!alterErr) {
          console.log("Added cooking_time column to recipes table.");
        }
      });

      // Add cuisine_type column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN cuisine_type TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding cuisine_type column:", alterErr);
        } else if (!alterErr) {
          console.log("Added cuisine_type column to recipes table.");
        }
      });

      // Add views column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN views INTEGER DEFAULT 0`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding views column:", alterErr);
        } else if (!alterErr) {
          console.log("Added views column to recipes table.");
        }
      });

      // Add description column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN description TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding description column:", alterErr);
        } else if (!alterErr) {
          console.log("Added description column to recipes table.");
        }
      });

      // Add difficulty column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN difficulty TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding difficulty column:", alterErr);
        } else if (!alterErr) {
          console.log("Added difficulty column to recipes table.");
        }
      });

      // Add meal_type column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN meal_type TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding meal_type column:", alterErr);
        } else if (!alterErr) {
          console.log("Added meal_type column to recipes table.");
        }
      });

      // Add rating column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN rating INTEGER`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding rating column:", alterErr);
        } else if (!alterErr) {
          console.log("Added rating column to recipes table.");
        }
      });

      // Add equipment column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN equipment TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding equipment column:", alterErr);
        } else if (!alterErr) {
          console.log("Added equipment column to recipes table.");
        }
      });

      // Add tags column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN tags TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding tags column:", alterErr);
        } else if (!alterErr) {
          console.log("Added tags column to recipes table.");
        }
      });

      // Add categories column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN categories TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding categories column:", alterErr);
        } else if (!alterErr) {
          console.log("Added categories column to recipes table.");
        }
      });

      // Add main_ingredient column if it doesn't exist
      db.run(`ALTER TABLE recipes ADD COLUMN main_ingredient TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Error adding main_ingredient column:", alterErr);
        } else if (!alterErr) {
          console.log("Added main_ingredient column to recipes table.");
        }
      });

      // Sync filesystem recipes to DB on startup
      try {
        const files = fs.readdirSync(recipesPath).filter((file) => path.extname(file) === ".md");
        const recipeNamesFromFS = files.map((file) => path.basename(file, ".md"));
        const fm = require("front-matter"); // Importar aquí para mantener el alcance local

        db.serialize(() => {
          const insertStmt = db.prepare("INSERT OR REPLACE INTO recipes (name, path, cooking_time, cuisine_type, views, description, difficulty, meal_type, rating, equipment, tags, categories, main_ingredient) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
          
          files.forEach((file) => {
            const name = path.basename(file, ".md");
            const fullPath = path.join(recipesPath, file);
            try {
              const fileContent = fs.readFileSync(fullPath, "utf8");
              const { attributes } = fm(fileContent);
              const views = attributes.views || 0;
              const cookingTime = attributes.time || null;
              const cuisineType = attributes.cuisine || null;
              const description = attributes.description || null;
              const difficulty = attributes.difficulty || null;
              const mealType = attributes.meal_type || null;
              const rating = attributes.rating || null;
              const equipment = attributes.equipment ? JSON.stringify(attributes.equipment) : null;
              const tags = attributes.tags ? JSON.stringify(attributes.tags) : null;
              const categories = attributes.categories ? JSON.stringify(attributes.categories) : null;
              const mainIngredient = attributes.main_ingredient ? JSON.stringify(attributes.main_ingredient) : null;

              insertStmt.run(name, fullPath, cookingTime, cuisineType, views, description, difficulty, mealType, rating, equipment, tags, categories, mainIngredient);
            } catch (e) {
              console.error(`Error al leer front-matter para ${name}: ${e.message}`);
              insertStmt.run(name, fullPath, null, null, 0, null, null, null, null, null, null, null, null); // Insertar con valores por defecto si falla
            }
          });
          insertStmt.finalize();

          if (recipeNamesFromFS.length > 0) {
            const placeholders = recipeNamesFromFS.map(() => "?").join(",");
            db.run(`DELETE FROM recipes WHERE name NOT IN (${placeholders})`, recipeNamesFromFS);
          } else {
            db.run(`DELETE FROM recipes`);
          }
          console.log(`Sincronizadas ${files.length} recetas con la base de datos (incluyendo metadatos).`);
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
        const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
        bcrypt.hash(adminPassword, saltRounds, (hashErr, hash) => {
          if (hashErr) return console.error("Error hasheando la contraseña del admin:", hashErr);

          // Usamos INSERT ... ON CONFLICT para actualizar la contraseña del admin si ya existe.
          // Esto asegura que el .env siempre sea la fuente de verdad.
          const sql = `
            INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')
            ON CONFLICT(username) DO UPDATE SET password=excluded.password, role='admin'`;
          const adminStmt = db.prepare(sql);
          adminStmt.run(hash, () => console.log("Usuario administrador asegurado."));
          adminStmt.finalize();
        });
      }
    );
  });
}

module.exports = { setupDatabase };