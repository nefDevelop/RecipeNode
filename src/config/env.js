const path = require("path");

// Valida las variables obligatorias en producción y expone rutas de datos.
// En desarrollo permite valores por defecto solo si NODE_ENV !== 'production'.
function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const sessionSecret = process.env.SESSION_SECRET || "";
  const port = parseInt(process.env.PORT || "8214", 10);

  const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../data");
  const recipesDir = process.env.RECIPES_DIR || path.join(__dirname, "../../recetas");

  const errors = [];
  if (!adminPassword) errors.push("ADMIN_PASSWORD vacía");
  else if (adminPassword.length < 16) errors.push("ADMIN_PASSWORD debe tener >=16 caracteres");
  if (!sessionSecret) errors.push("SESSION_SECRET vacía");
  else if (sessionSecret.length < 32) errors.push("SESSION_SECRET debe tener >=32 caracteres");
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("PORT inválido");

  if (errors.length && isProd) {
    console.error("Configuración inválida en producción:\n- " + errors.join("\n- "));
    console.error("Rellena .env (ver .env.example) y vuelve a arrancar.");
    process.exit(1);
  }
  if (errors.length && !isProd) {
    console.warn("[dev] Usando valores por defecto inseguros solo para desarrollo: " + errors.join("; "));
  }

  return {
    nodeEnv,
    isProd,
    adminPassword: adminPassword || "dev-admin-password-cambiar",
    sessionSecret: sessionSecret || "dev-session-secret-cambiar-no-usar-en-prod-0123456789",
    port,
    dataDir: path.resolve(dataDir),
    recipesDir: path.resolve(recipesDir),
    trustProxy: process.env.TRUST_PROXY || "0",
    corsOrigin: process.env.CORS_ORIGIN || "",
  };
}

module.exports = loadEnv();
