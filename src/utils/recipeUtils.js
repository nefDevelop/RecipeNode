/**
 * Extrae, filtra y limpia los ingredientes del contenido de una receta en Markdown.
 * Sigue una lógica específica para asegurar la calidad de la lista de la compra.
 *
 * @param {string} markdownBody El contenido completo del archivo .md de la receta.
 * @returns {string[]} Un array de strings, donde cada string es un ingrediente limpio.
 */
function extractIngredients(markdownBody) {
  const lines = markdownBody.split("\n");
  const ingredients = [];
  let inSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();

    // 1. Detectar el inicio de la sección de ingredientes
    // Es más flexible: busca el encabezado, incluso si no es un Hx
    if (lowerLine.includes("ingredientes") && (lowerLine.startsWith("#") || lowerLine.length < 20)) {
      inSection = true;
      continue; // No incluir el encabezado, pasar a la siguiente línea
    }

    if (inSection) {
      // 2. Detectar el final de la sección (cuando empieza otra sección con #)
      if (line.trim().startsWith("#")) {
        break;
      }

      // 3. FILTRAR: Procesar solo las líneas que parecen ser un ingrediente.
      // Esto descarta subtítulos como "Para la salsa", etc. y líneas descriptivas.
      const isIngredientLine = /^\s*-\s*(\[[ x]\])?/i.test(line) || /^\s*(\[[ x]\])/i.test(line);

      if (isIngredientLine) {


        // 4. LIMPIAR TACHADO: Eliminar la sintaxis de tachado de Markdown (~~...~~)
        let cleanedLine = line.replace(/~~/g, "");

        // 5. LIMPIAR CHECKBOX Y MARCADORES: Eliminar la sintaxis de checkbox y marcadores de lista.
        cleanedLine = cleanedLine.replace(/^\s*-\s*(\[[ x]\])?\s*/, "");
        cleanedLine = cleanedLine.replace(/^\s*(\[[ x]\])\s*/, "");

        // 6. LIMPIAR ESPACIOS: Eliminar espacios en blanco al principio y al final.
        cleanedLine = cleanedLine.trim();

        // Añadir a la lista solo si la línea no está vacía después de la limpieza.
        if (cleanedLine) {
          ingredients.push(cleanedLine.replace(/\.$/, "")); // Elimina el punto final si existe
        }
      }
    }
  }
  return ingredients;
}

module.exports = { extractIngredients };
