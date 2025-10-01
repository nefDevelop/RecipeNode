const fs = require("fs");
const path = require("path");
const marked = require("marked");
const fm = require("front-matter");
const db = require("../config/database");
const axios = require("axios");
const cheerio = require("cheerio");

// --- Database Promise Wrappers ---
// These helpers convert the callback-based sqlite3 methods to Promise-based ones.
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, (err) => (err ? reject(err) : resolve())));

// Helper function to create a URL-friendly slug from a title
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

const admonitionTypes = {
  NOTE: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    title: "Nota",
  },
  TIP: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>`,
    title: "Consejo",
  },
  WARNING: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    title: "Advertencia",
  },
  QUESTION: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    title: "Pregunta",
  },
};

/**
 * Extrae la primera imagen de una receta, buscando en el frontmatter y luego en el cuerpo
 * del texto antes de la sección de "Ingredientes".
 * Soporta formatos: frontmatter (image:), HTML (<img>), Obsidian (![[...]]) y Markdown (![]()).
 * @param {object} attributes - El frontmatter del archivo.
 * @param {string} body - El cuerpo del archivo markdown.
 * @returns {string|null} La URL de la imagen o null si no se encuentra.
 */
function extractImageFromMarkdown(attributes, body) {
  // 1. Buscar en el frontmatter
  if (attributes && (attributes.image || attributes.cover)) {
    return attributes.image || attributes.cover;
  }

  if (!body) return null;

  // 2. Limitar la búsqueda al contenido ANTES de la sección de ingredientes
  const ingredientsIndex = body.toLowerCase().indexOf("ingredientes");
  const searchBody = ingredientsIndex !== -1 ? body.substring(0, ingredientsIndex) : body;

  // 3. Buscar en el cuerpo del texto (en orden de prioridad)

  // Formato HTML: <img src="..."
  let match = searchBody.match(/<img[^>]+src="([^"]+)"/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Formato Obsidian: ![[imagen.jpg]]
  match = searchBody.match(/!\[\[(.*?)(?:\|.*)?\]\]/);
  if (match && match[1]) {
    const imageName = match[1].trim();
    // Normalizar la ruta si es un adjunto local
    const resourcesIndex = imageName.indexOf("_resources");
    if (resourcesIndex !== -1) {
      return "/" + imageName.substring(resourcesIndex);
    }
    const attachmentIndex = imageName.indexOf("attachment");
    if (attachmentIndex !== -1) {
      return "/" + imageName.substring(attachmentIndex);
    }
    return imageName;
  }

  // Formato Markdown estándar: ![alt](src)
  match = searchBody.match(/!\[.*?\]\((.*?)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

const getHomePage = async (req, res) => {
  try {
    const recipeName = req.query.recipe;

    // --- Common settings fetching logic ---
    let recipeCardDisplaySettings = await dbAll("SELECT value FROM unit_settings WHERE id = 'recipe_card_display_fields'");
    let settings = {};
    if (recipeCardDisplaySettings.length > 0) {
      settings.recipe_card_display_fields = JSON.parse(recipeCardDisplaySettings[0].value);
    } else {
      // Default display settings
      settings.recipe_card_display_fields = {
        image: true,
        name: true,
        difficulty: true,
        cookingTime: true,
        tags: true,
        mainIngredient: true,
      };
    }
    // --- End common settings fetching logic ---

    if (recipeName) {
      await dbRun("UPDATE recipes SET views = views + 1 WHERE name = ?", [recipeName]);
      const recipeRow = await dbGet("SELECT path, views FROM recipes WHERE name = ?", [recipeName]);

      if (!recipeRow) {
        return res.render("index", {
          title: "Receta no encontrada",
          content: `La receta "${recipeName}" no existe.`, // Corrected escaping for template literal
          recipes: null,
          user: req.session,
          sortBy: req.query.sort_by || 'name_asc', // Ensure sortBy is always passed
        });
      }

      const fileStats = await fs.promises.stat(recipeRow.path);
      const mtime = fileStats.mtime;

      const fileContent = await fs.promises.readFile(recipeRow.path, "utf8");
      let { attributes, body: rawBody } = fm(fileContent);

      // Increment view count
      attributes.views = (attributes.views || 0) + 1;

      // Reconstruct front-matter and content
      const updatedFrontMatter = `---\n${Object.entries(attributes).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n`;
      const updatedFileContent = updatedFrontMatter + rawBody;

      // Write updated content back to file
      await fs.promises.writeFile(recipeRow.path, updatedFileContent, "utf8");

      // 1. Limpiar el contenido de Markdown de sintaxis no estándar (Dataview, comentarios)
      let markdownContent = rawBody
        .replace(/%%.*?%%/g, "") // Eliminar comentarios de Obsidian %%...%%
        .replace(/`\$=.*?`/g, "") // Eliminar scripts inline de Dataview
        .replace(/```dataviewjs[\s\S]*?```/g, ""); // Eliminar bloques de código dataviewjs
      //.replace(/^#\s*`\$= dv\.current\(\)\.title`\s*$/gm, ""); // Eliminar la línea del título si es de Dataview

      // 2. Pre-procesar el markdown para estandarizar la sintaxis de Obsidian
      let processedMarkdown = markdownContent
        // Convierte enlaces de imagen ![[imagen.jpg]] a etiquetas <img>
        .replace(/!\[\[(.*?)(?:\|.*)?\]\]/g, (match, imageName) => {
          const cleanName = imageName.trim();
          const finalImageName = cleanName.split("/").pop();
          return `<img src="/resources/${finalImageName}" alt="${finalImageName}" class="mx-auto my-4 rounded-md shadow-md">`;
        })
        // Convierte enlaces a notas [[Otra Receta]] a enlaces <a>
        .replace(/\[\[([^\]|\n]+)(?:\|([^\]|\n]+))?\]\]/g, (match, linkTarget, linkText) => {
          const text = linkText || linkTarget;
          return `<a href="/?recipe=${encodeURIComponent(linkTarget.trim())}" class="text-green-600 hover:underline">${text.trim()}</a>`;
        })
        // Convierte admonitions > [!NOTE] a divs estilizados
        .replace(/>\s*\[!(.*?)\]\n((?:>\s*.*(?:\n|$))+)/g, (match, type, content) => {
          const admonitionType = type.toUpperCase();
          const admonition = admonitionTypes[admonitionType];
          if (!admonition) {
            return match; // Si el tipo no existe, no hacer nada
          }

          // Limpiar el contenido del admonition
          const cleanedContent = content.replace(/>\s?/g, '').trim();
          const parsedContent = marked.parse(cleanedContent);

          return `
            <div class="admonition admonition-${admonitionType.toLowerCase()}">
              <div class="admonition-heading">
                ${admonition.icon}
                <p>${admonition.title}</p>
              </div>
              <div class="admonition-content">
                ${parsedContent}
              </div>
            </div>
          `;
        });

      // 3. Convertir el Markdown (que ahora puede contener HTML) a HTML final.
      // `marked` procesará la sintaxis de markdown y dejará intactas las etiquetas <img> que hemos insertado.
      const markedOptions = {
        gfm: true, // Habilitar GitHub Flavored Markdown para reconocer las task lists
        pedantic: false,
        breaks: false,
      };
      let htmlContent = marked.parse(processedMarkdown, markedOptions);

      // 4. Post-procesar el HTML para corregir rutas de imágenes que no eran de tipo ![[...]]
      // Esto arregla rutas como <img src="../_resources/"> o !alt
      htmlContent = htmlContent.replace(/src="(\.\.\/)?_resources\/(.*?)"/g, 'src="/resources/$2"');
      // 5. Habilitar los checkboxes de las listas de tareas eliminando el atributo 'disabled'.
      // Esto permite que los usuarios los marquen mientras cocinan.
      htmlContent = htmlContent.replace(/<input disabled=""/g, "<input");

      // 6. Identificar y envolver patrones de tiempo para temporizadores interactivos
      htmlContent = htmlContent.replace(/(\d+)\s+(minuto|segundo)s?/gi, (match, number, unit) => {
        let duration = parseInt(number, 10);
        if (unit.toLowerCase().startsWith('minut')) { // 'minuto' or 'minutos'
          duration *= 60;
        }
        return `<span class="timer-trigger" data-duration="${duration}">${match}</span>`;
      });

      // --- LOGS DE ESTILOS ---
      console.log(`\n--- [RECETA: ${recipeName}] Análisis de Estilos en HTML ---
`);
      const classMatches = htmlContent.match(/class="[^"]+"/g) || [];
      const styleMatches = htmlContent.match(/style="[^"]+"/g) || [];
      console.log(`[Estilos] Clases CSS encontradas (${classMatches.length}):`, classMatches);
      console.log(`[Estilos] Estilos en línea encontrados (${styleMatches.length}):`, styleMatches);


      const mostViewedRecipes = await dbAll("SELECT name, views FROM recipes ORDER BY views DESC, name ASC LIMIT 5");
      res.render("index", {
        title: attributes.title || recipeName,
        content: htmlContent,
        servings: attributes.servings,
        views: recipeRow.views, // Pass views to the template
        recipes: null,
        mostViewed: mostViewedRecipes,
        user: req.session,
        settings: settings, // Pass the settings object to the template
        sortBy: req.query.sort_by || 'name_asc', // Ensure sortBy is always passed
      });
    } else {
      const sortBy = req.query.sort_by || 'name_asc'; // Default sorting
      let orderByClause = '';

      switch (sortBy) {
        case 'name_asc':
          orderByClause = 'ORDER BY name ASC';
          break;
        case 'name_desc':
          orderByClause = 'ORDER BY name DESC';
          break;
        case 'date_added_desc':
          orderByClause = 'ORDER BY created_at DESC';
          break;
        case 'views_desc':
          orderByClause = 'ORDER BY views DESC';
          break;
        default:
          orderByClause = 'ORDER BY name ASC';
      }

      const allRecipes = await dbAll(`SELECT name, path, views, cooking_time, cuisine_type, description, difficulty, meal_type, rating, equipment, tags, categories, main_ingredient FROM recipes ${orderByClause}`);

      const recipesWithData = await Promise.all(
        allRecipes.map(async (recipe) => {
          try {
            const fileContent = await fs.promises.readFile(recipe.path, "utf8");
            const { attributes, body } = fm(fileContent);
            const image = extractImageFromMarkdown(attributes, body);

            // Parse JSON fields into arrays
            const parsedRecipe = { ...recipe, image };
            try {
              if (parsedRecipe.tags) parsedRecipe.tags = JSON.parse(parsedRecipe.tags);
            } catch (e) { /* ignore if not valid JSON */ }
            try {
              if (parsedRecipe.equipment) parsedRecipe.equipment = JSON.parse(parsedRecipe.equipment);
            } catch (e) { /* ignore */ }
            try {
              if (parsedRecipe.categories) parsedRecipe.categories = JSON.parse(parsedRecipe.categories);
            } catch (e) { /* ignore */ }
            try {
              if (parsedRecipe.main_ingredient) parsedRecipe.main_ingredient = JSON.parse(parsedRecipe.main_ingredient);
            } catch (e) { /* ignore */ }

            return parsedRecipe;
          } catch (e) {
            console.error(`Error processing recipe ${recipe.name}: ${e.message}`);
            return { ...recipe, image: null }; // return DB data even if file fails
          }
        })
      );



      const mostViewedRecipes = await dbAll("SELECT name, views FROM recipes ORDER BY views DESC, name ASC LIMIT 5");
      res.render("index", {
        title: "Recetas",
        content: null,
        recipes: recipesWithData,
        mostViewed: mostViewedRecipes,
        user: req.session,
        servings: null, // Asegurarse de que 'servings' siempre esté definido
        settings: settings, // Pass the settings object to the template
        sortBy: sortBy, // Pass the current sorting option to the template
      });
    }
  } catch (error) {
    console.error("Error al obtener la página de recetas:", error);
    res.status(500).send("Error interno del servidor");
  }
};

const getShoppingListPage = (req, res) => {
  // recipeTitles is now provided by middleware
  res.render("shopping-list", { title: "Lista de la Compra", user: req.session });
};

const getAllRecipesApi = async (req, res) => {
  try {
    const { search, time_max, ingredients, cuisine, difficulty, meal_type, rating, equipment, tags, main_ingredient } = req.query;
    let sql = "SELECT name, path, cooking_time, cuisine_type, description, difficulty, meal_type, rating, equipment, tags, main_ingredient FROM recipes WHERE 1=1";
    const params = [];

    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (time_max) {
      sql += " AND cooking_time <= ?";
      params.push(parseInt(time_max));
    }
    if (cuisine) {
      sql += " AND cuisine_type = ?";
      params.push(cuisine);
    }
    if (difficulty) {
      sql += " AND difficulty = ?";
      params.push(difficulty);
    }
    if (meal_type) {
      sql += " AND meal_type = ?";
      params.push(meal_type);
    }
    if (rating) {
      sql += " AND rating >= ?"; // Assuming rating is a number and we want >=
      params.push(parseInt(rating));
    }

    // For array-like fields, use LIKE to search within the JSON string
    if (equipment) {
      sql += " AND equipment LIKE ?";
      params.push(`%"${equipment}"%`);
    }
    if (tags) {
      sql += " AND tags LIKE ?";
      params.push(`%"${tags}"%`);
    }
    if (main_ingredient) {
      sql += " AND main_ingredient LIKE ?";
      params.push(`%"${main_ingredient}"%`);
    }

    // For ingredients, we'll fetch all matching recipes first and then filter by content
    let filteredRecipes = await dbAll(sql + " ORDER BY name", params);

    if (ingredients) {
      const ingredientList = ingredients.split(",").map(item => item.trim().toLowerCase());
      const recipesWithContent = await Promise.all(
        filteredRecipes.map(async (recipe) => {
          try {
            const fileContent = await fs.promises.readFile(recipe.path, "utf8");
            return { ...recipe, content: fileContent };
          } catch (e) {
            console.error(`Error reading file for ingredient filter ${recipe.name}: ${e.message}`);
            return null;
          }
        })
      );
      filteredRecipes = recipesWithContent.filter(recipe => {
        if (!recipe || !recipe.content) return false;
        return ingredientList.every(ingredient => recipe.content.toLowerCase().includes(ingredient));
      });
    }

    const recipesWithImages = await Promise.all(
      filteredRecipes.map(async (recipe) => {
        try {
          const fileContent = await fs.promises.readFile(recipe.path, "utf8");
          const { attributes, body } = fm(fileContent);
          const image = extractImageFromMarkdown(attributes, body);
          return {
            name: recipe.name,
            image,
            difficulty: recipe.difficulty,
            cooking_time: recipe.cooking_time,
            tags: recipe.tags ? JSON.parse(recipe.tags) : [], // Parse tags if they are JSON strings
            main_ingredient: recipe.main_ingredient,
          };
        } catch (e) {
          console.error(`Error processing recipe ${recipe.name}: ${e.message}`);
          return { name: recipe.name, image: null };
        }
      })
    );

    res.json(recipesWithImages);
  } catch (error) {
    console.error("Error fetching recipe list for API:", error);
    return res.status(500).json({ error: "Failed to retrieve recipes from database." });
  }
};

const getRecipeByIdApi = async (req, res) => {
  const recipeName = req.params.id;

  try {
    await dbRun("UPDATE recipes SET views = views + 1 WHERE name = ?", [recipeName]);
    await dbRun("UPDATE recipes SET views = views + 1 WHERE name = ?", [recipeName]);
    const recipeRow = await dbGet("SELECT path, views FROM recipes WHERE name = ?", [recipeName]);

    if (!recipeRow) {
      return res.status(404).json({ error: `Recipe "${recipeName}" not found.` });
    }

    const fileContent = await fs.promises.readFile(recipeRow.path, "utf8");
    let { attributes, body: rawBody } = fm(fileContent);

    // Sincronizar el contador de la BD al archivo .md
    if (attributes.views !== recipeRow.views) {
      attributes.views = recipeRow.views;
      const updatedFrontMatter = `---\n${Object.entries(attributes).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n`;
      await fs.promises.writeFile(recipeRow.path, updatedFrontMatter + rawBody, "utf8");
    }

    // Lógica de renderizado consistente con getHomePage
    let markdownContent = rawBody
      .replace(/%%.*?%%/g, "")
      .replace(/`\$=.*?`/g, "")
      .replace(/^#\s*`\$= dv\.current\(\)\.title`\s*$/gm, "")
      .replace(/```dataviewjs[\s\S]*?```/g, ""); // Eliminar bloques de código dataviewjs

    // Lógica de pre-procesamiento consistente
    let processedMarkdown = markdownContent
      // Convierte enlaces de imagen ![[imagen.jpg]] a etiquetas <img>
      .replace(/!\[\[(.*?)(?:\|.*)?\]\]/g, (match, imageName) => {
        const cleanName = imageName.trim();
        const finalImageName = cleanName.split("/").pop();
        return `<img src="/resources/${finalImageName}" alt="${finalImageName}" class="mx-auto my-4 rounded-md shadow-md">`;
      })
      // Convierte enlaces a notas [[Otra Receta]] a enlaces <a>
      .replace(/\[\[([^\]|\n]+)(?:\|([^\]|\n]+))?\]\]/g, (match, linkTarget, linkText) => {
        const text = linkText || linkTarget;
        return `<a href="/?recipe=${encodeURIComponent(linkTarget.trim())}" class="text-green-600 hover:underline">${text.trim()}</a>`;
      })
      // Convierte admonitions > [!NOTE] a divs estilizados
      .replace(/>\s*\[!(.*?)\]\n((?:>\s*.*(?:\n|$))+)/g, (match, type, content) => {
        const admonitionType = type.toUpperCase();
        const admonition = admonitionTypes[admonitionType];
        if (!admonition) {
          return match; // Si el tipo no existe, no hacer nada
        }

        // Limpiar el contenido del admonition
        const cleanedContent = content.replace(/>\s?/g, '').trim();
        const parsedContent = marked.parse(cleanedContent);

        return `
          <div class="admonition admonition-${admonitionType.toLowerCase()}">
            <div class="admonition-heading">
              ${admonition.icon}
              <p>${admonition.title}</p>
            </div>
            <div class="admonition-content">
              ${parsedContent}
            </div>
          </div>
        `;
      });
    const markedOptions = {
      gfm: true, // Habilitar GitHub Flavored Markdown para reconocer las task lists
      pedantic: false,
      breaks: false,
    };
    let htmlContent = marked.parse(processedMarkdown, markedOptions);
    htmlContent = htmlContent.replace(/src="(\.\.\/)?_resources\/(.*?)"/g, 'src="/resources/$2"');
    // Habilitar los checkboxes de las listas de tareas eliminando el atributo 'disabled'.
    htmlContent = htmlContent.replace(/<input disabled=""/g, "<input");

    // 6. Identificar y envolver patrones de tiempo para temporizadores interactivos
    htmlContent = htmlContent.replace(/(\d+)\s+(minuto|segundo)s?/gi, (match, number, unit) => {
      let duration = parseInt(number, 10);
      if (unit.toLowerCase().startsWith('minut')) { // 'minuto' or 'minutos'
        duration *= 60;
      }
      return `<span class="timer-trigger" data-duration="${duration}">${match}</span>`;
    });

    // --- LOGS DE ESTILOS ---
    console.log(`\n--- [API RECETA: ${recipeName}] Análisis de Estilos en HTML ---
`);
    console.log(`[Estilos] Clases CSS encontradas:`, htmlContent.match(/class="[^"]+"/g) || []);
    console.log(`[Estilos] Estilos en línea encontrados:`, htmlContent.match(/style="[^"]+"/g) || []);
    console.log(`--- Fin del análisis ---
`);

    attributes.views = recipeRow.views;

    res.json({
      id: recipeName,
      title: attributes.title || recipeName,
      attributes: attributes,
      contentHtml: htmlContent,
    });
  } catch (error) {
    console.error(`API Error processing recipe ${recipeName}:`, error);
    res.status(500).json({ error: "Internal server error while processing the recipe." });
  }
};

const createRecipeApi = async (req, res) => {
  const { title, markdownContent, source, image } = req.body;

  if (!title || !markdownContent) {
    return res.status(400).json({ error: "Title and markdownContent are required." });
  }

  const slug = slugify(title);
  const filename = `${slug}.md`;
  const recipesPath = path.join(__dirname, "../../recetas");
  const filePath = path.join(recipesPath, filename);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: `A recipe with the title "${title}" already exists.` });
  }

  const now = new Date().toISOString();
  let frontmatter = `---\ntitle: "${title.replace(/"/g, '\"')}"
`;
  if (source) frontmatter += `source: ${source}
`;
  if (image) frontmatter += `image: ${image}
`;
  frontmatter += `created: ${now}
`;
  frontmatter += `updated: ${now}
`;

  // Extract all attributes from markdownContent
  const { attributes: newAttributes } = fm(frontmatter + markdownContent);

  const cookingTime = newAttributes.time || null;
  const cuisineType = newAttributes.cuisine || null;
  const description = newAttributes.description || null;
  const difficulty = newAttributes.difficulty || null;
  const mealType = newAttributes.meal_type || null;
  const rating = newAttributes.rating || null;
  const equipment = newAttributes.equipment ? JSON.stringify(newAttributes.equipment) : null;
  const tags = newAttributes.tags ? JSON.stringify(newAttributes.tags) : null;
  const mainIngredient = newAttributes.main_ingredient ? JSON.stringify(newAttributes.main_ingredient) : null;


  frontmatter += `---

`;
  const fileContent = frontmatter + markdownContent;

  try {
    await fs.promises.writeFile(filePath, fileContent, "utf8");
    await dbRun(
      "INSERT INTO recipes (name, path, cooking_time, cuisine_type, description, difficulty, meal_type, rating, equipment, tags, main_ingredient, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [slug, filePath, cookingTime, cuisineType, description, difficulty, mealType, rating, equipment, tags, mainIngredient, now]
    );

    // Añadimos una URL de redirección a la respuesta.
    // El cliente usará esta URL para recargar la página y ver la nueva receta.
    res.status(201).json({
      message: "Recipe created successfully",
      redirectUrl: `/?recipe=${slug}`,
    });
  } catch (error) {
    console.error("Error creating recipe:", error);
    // Intenta eliminar el archivo si se creó pero la inserción en la BD falló.
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ error: "Failed to create recipe." });
  }
};
const scrapeRecipeApi = async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // --- Data Extraction (this is heuristic and may need adjustment per site) ---
    // 1. Extraer TODAS las imágenes relevantes
    const imageSet = new Set();
    // Prioridad 1: Meta tags (og:image, twitter:image)
    $('meta[property="og:image"]').each((i, el) => $(el).attr("content") && imageSet.add($(el).attr("content")));
    $('meta[name="twitter:image"]').each((i, el) => $(el).attr("content") && imageSet.add($(el).attr("content")));

    // Prioridad 2: Imágenes dentro del contenido principal del artículo
    $("article img, .recipe-content img, .post-content img").each((i, el) => {
      const src = $(el).attr("src");
      // Ignorar imágenes en base64 o placeholders
      if (src && !src.startsWith("data:")) {
        imageSet.add(src);
      }
    });

    // Convertir a URLs absolutas y eliminar duplicados
    const images = [...imageSet].map((img) => new URL(img, url).href);

    const title = $("h1").first().text().trim();
    if (!title) {
      return res.status(400).json({ error: "Could not automatically find a title on the page." });
    }

    // --- Heurística mejorada para separar ingredientes y pasos ---
    // --- Nueva Estrategia para Ingredientes: Encontrar todos los bloques <ul> candidatos ---
    const potentialIngredients = new Set();
    // Buscar todas las listas no ordenadas con al menos 2 items
    $("ul").each((i, list) => {
      const $list = $(list);
      if ($list.find("li").length > 1) {
        // Añadir el HTML de la lista como un candidato
        potentialIngredients.add($list.prop("outerHTML"));
      }
    });

    // --- Nueva Estrategia para Pasos: Capturar contenido entre encabezados relevantes ---
    const potentialSteps = new Set();

    // Estrategia definitiva: de un header al siguiente, sin importar la estructura.
    const allElements = $("body").find("*");
    let currentBlock = null;

    allElements.each((index, element) => {
      const $el = $(element);

      // Si es un encabezado, empezamos un nuevo bloque.
      if ($el.is("h2, h3, h4")) {
        // Si ya teníamos un bloque, lo guardamos antes de empezar el nuevo.
        if (currentBlock) {
          potentialSteps.add(currentBlock.html());
        }
        // Creamos el nuevo bloque y le añadimos el encabezado actual.
        currentBlock = $("<div></div>").append($el.clone());
      } else if (currentBlock) {
        // Si no es un encabezado pero estamos dentro de un bloque, añadimos el elemento.
        currentBlock.append($el.clone());
      }
    });
    // No olvides guardar el último bloque encontrado.
    if (currentBlock) potentialSteps.add(currentBlock.html());

    // En lugar de crear el archivo, devolvemos el contenido para que el usuario lo verifique.
    // El frontend se encargará de llamar a 'createRecipeApi' con estos datos.
    res.status(200).json({
      title: title,
      images: images,
      potentialIngredients: [...potentialIngredients],
      potentialSteps: [...potentialSteps],
      source: url, // Devolvemos también la URL de origen
    });
  } catch (error) {
    console.error("Error scraping recipe:", error);
    res.status(500).json({ error: "Failed to scrape or process the recipe." });
  }
};

const getAvailableFiltersApi = async (req, res) => {
  console.log("getAvailableFiltersApi called.");
  try {
    const filters = {};

    // Fetch distinct values for simple fields
    const simpleFields = ['cuisine_type', 'difficulty', 'meal_type', 'rating'];
    for (const field of simpleFields) {
      console.log(`Fetching distinct values for simple field: ${field}`);
      const rows = await dbAll(`SELECT DISTINCT ${field} FROM recipes WHERE ${field} IS NOT NULL AND ${field} != ''`);
      filters[field] = rows.map(row => row[field]);
    }

    // Fetch and process array-like fields (tags, main_ingredient, equipment)
    const arrayFields = ['tags', 'main_ingredient', 'equipment'];
    for (const field of arrayFields) {
      console.log(`Fetching distinct values for array field: ${field}`);
      const rows = await dbAll(`SELECT ${field} FROM recipes WHERE ${field} IS NOT NULL AND ${field} != ''`);
      const allValues = new Set();
      rows.forEach(row => {
        try {
          // Assuming these are stored as comma-separated strings or JSON arrays
          let values = [];
          if (typeof row[field] === 'string') {
            if (row[field].startsWith('[') && row[field].endsWith(']')) {
              // Try parsing as JSON array
              values = JSON.parse(row[field]);
            } else {
              // Assume comma-separated string
              values = row[field].split(',').map(v => v.trim());
            }
          } else if (Array.isArray(row[field])) {
            values = row[field];
          }
          values.forEach(val => {
            // Ensure val is a string before calling replace
            if (typeof val === 'string' && val) {
              allValues.add(val.replace(/[\[\]]/g, '')); // Clean up Obsidian link syntax if present
            } else if (Array.isArray(val)) {
              // If it's an array, flatten it and process its elements
              val.forEach(innerVal => {
                if (typeof innerVal === 'string' && innerVal) {
                  allValues.add(innerVal.replace(/[\[\]]/g, ''));
                }
              });
            }
          });
        } catch (e) {
          console.error(`Error parsing field ${field} for row:`, row[field], e);
        }
      });
      filters[field] = Array.from(allValues);
    }

    console.log("Sending filters response:", filters);
    res.json(filters);
  } catch (error) {
    console.error("Error fetching available filters:", error);
    res.status(500).json({ error: "Failed to retrieve available filters." });
  }
};

module.exports = {
  getHomePage,
  getShoppingListPage,
  getAllRecipesApi,
  getRecipeByIdApi,
  createRecipeApi,
  scrapeRecipeApi,
  getAvailableFiltersApi,
};
