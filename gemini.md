# 🤖 Guía de Interacción con Gemini Code Assist

Este documento sirve como una guía para interactuar eficazmente con Gemini Code Assist en el contexto de este proyecto. El objetivo es maximizar la calidad de las respuestas y la eficiencia del desarrollo.

## 📜 Contexto del Proyecto

Antes de hacer una pregunta, asegúrate de que Gemini tiene el contexto necesario.

- **Tecnologías Principales**: Node.js, [Express, Fastify, etc.], [Base de datos, ej: PostgreSQL, MongoDB].
- **Tecnologías Principales**: Node.js, Express.js, SQLite. El frontend se sirve con archivos HTML.
- **Objetivo del Proyecto**: Crear una aplicación web para gestionar y compartir recetas de cocina.
- **Archivos Clave**:
  - `package.json`: Define las dependencias y scripts.
  - `index.js` / `app.js`: Punto de entrada de la aplicación.
  - `src/routes/`: Directorio donde se definen las rutas de la API.
  - `src/controllers/`: Lógica de negocio para cada ruta.
  - `database.js`: Archivo de configuración y conexión para SQLite.
  - `views/`: Directorio para los archivos HTML que se mostrarán.

## ✍️ Cómo Formular Preguntas (Prompts)

Para obtener los mejores resultados, sigue estas pautas al crear tus prompts:

1.  **Sé Específico**: En lugar de "ayúdame con el código", prueba con "revisa esta función en `src/controllers/userController.js` para mejorar su rendimiento y legibilidad".
2.  **Proporciona Contexto**: Incluye los fragmentos de código relevantes o los nombres de los archivos con los que estás trabajando.
3.  **Define el Objetivo**: Explica claramente lo que quieres lograr. ¿Es una nueva funcionalidad, una refactorización, depuración o documentación?
4.  **Muestra lo que has Intentado**: Si estás atascado, menciona las soluciones que ya has probado. Esto ayuda a evitar sugerencias repetidas.

---

### Ejemplos de Prompts Efectivos

#### Para crear código nuevo

> "En el archivo `src/routes/productRoutes.js`, crea una nueva ruta `POST /products` que utilice el controlador `createProduct` de `src/controllers/productController.js`. Asegúrate de incluir validación de entrada para los campos `name` (string, requerido) y `price` (number, requerido)."

#### Para refactorizar o revisar código

> "Revisa el siguiente código del archivo `src/services/authService.js`. Sugiere mejoras en cuanto a seguridad, manejo de errores y buenas prácticas de async/await. Quiero asegurarme de que el manejo de contraseñas sea seguro."

#### Para depurar un error

> "Estoy recibiendo el siguiente error al intentar iniciar el servidor: `[Pega el mensaje de error completo aquí]`. He revisado mi archivo `.env` y las variables de conexión parecen correctas. ¿Qué podría estar causando este problema en `src/config/database.js`?"

#### Para generar pruebas

> "Genera pruebas unitarias usando Jest para la función `calculateTotal` en `src/utils/calculations.js`. Asegúrate de cubrir los casos límite, como entradas nulas o valores negativos."

