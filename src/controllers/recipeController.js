const fs = require("fs");
const path = require("path");
const marked = require("marked");
const fm = require("front-matter");
const db = require("../config/database");
const axios = require("axios");
const cheerio = require("cheerio");

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

    if (recipeName) {
      const recipeRow = await new Promise((resolve, reject) => {
        db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, row) => (err ? reject(err) : resolve(row)));
      });

      if (!recipeRow) {
        return res.render("index", {
          title: "Receta no encontrada",
          content: `La receta "${recipeName}" no existe.`,
          recipes: null,
          user: req.session,
        });
      }

      const fileContent = await fs.promises.readFile(recipeRow.path, "utf8");
      const { attributes, body: rawBody } = fm(fileContent);

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
        .replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, linkTarget, linkText) => {
          const text = linkText || linkTarget;
          return `<a href="/?recipe=${encodeURIComponent(linkTarget.trim())}" class="text-green-600 hover:underline">${text.trim()}</a>`;
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
      // Esto arregla rutas como <img src="../_resources/..."> o !alt
      htmlContent = htmlContent.replace(/src="(\.\.\/)?_resources\/(.*?)"/g, 'src="/resources/$2"');
      // 5. Habilitar los checkboxes de las listas de tareas eliminando el atributo 'disabled'.
      // Esto permite que los usuarios los marquen mientras cocinan.
      htmlContent = htmlContent.replace(/<input disabled=""/g, "<input");

      // --- LOGS DE ESTILOS ---
      console.log(`\n--- [RECETA: ${recipeName}] Análisis de Estilos en HTML ---`);
      const classMatches = htmlContent.match(/class="[^"]+"/g) || [];
      const styleMatches = htmlContent.match(/style="[^"]+"/g) || [];
      console.log(`[Estilos] Clases CSS encontradas (${classMatches.length}):`, classMatches);
      console.log(`[Estilos] Estilos en línea encontrados (${styleMatches.length}):`, styleMatches);
      console.log(`--- Fin del análisis ---\n`);

      res.render("index", {
        title: attributes.title || recipeName,
        content: htmlContent,
        servings: attributes.servings,
        recipes: null,
        user: req.session,
      });
    } else {
      const allRecipes = await new Promise((resolve, reject) => {
        db.all("SELECT name, path FROM recipes ORDER BY name", [], (err, rows) => (err ? reject(err) : resolve(rows)));
      });

      const recipesWithImages = await Promise.all(
        allRecipes.map(async (recipe) => {
          try {
            const fileContent = await fs.promises.readFile(recipe.path, "utf8");
            const { attributes, body } = fm(fileContent);
            const image = extractImageFromMarkdown(attributes, body);
            return { name: recipe.name, image };
          } catch (e) {
            console.error(`Error processing recipe ${recipe.name}: ${e.message}`);
            return { name: recipe.name, image: null };
          }
        })
      );

      res.render("index", {
        title: "Recetas",
        content: null,
        recipes: recipesWithImages,
        user: req.session,
        servings: null, // Asegurarse de que 'servings' siempre esté definido
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

const getAllRecipesApi = (req, res) => {
  db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error("Error fetching recipe list for API:", err);
      return res.status(500).json({ error: "Failed to retrieve recipes from database." });
    }
    const recipeNames = rows.map((r) => r.name);
    res.json(recipeNames);
  });
};

const getRecipeByIdApi = async (req, res) => {
  const recipeName = req.params.id;

  try {
    const recipeRow = await new Promise((resolve, reject) => {
      db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!recipeRow) {
      return res.status(404).json({ error: `Recipe "${recipeName}" not found.` });
    }

    const fileContent = await fs.promises.readFile(recipeRow.path, "utf8");
    const { attributes, body: rawBody } = fm(fileContent);

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
      .replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, linkTarget, linkText) => {
        const text = linkText || linkTarget;
        return `<a href="/?recipe=${encodeURIComponent(linkTarget.trim())}" class="text-green-600 hover:underline">${text.trim()}</a>`;
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

    // --- LOGS DE ESTILOS ---
    console.log(`\n--- [API RECETA: ${recipeName}] Análisis de Estilos en HTML ---`);
    console.log(`[Estilos] Clases CSS encontradas:`, htmlContent.match(/class="[^"]+"/g) || []);
    console.log(`[Estilos] Estilos en línea encontrados:`, htmlContent.match(/style="[^"]+"/g) || []);
    console.log(`--- Fin del análisis ---\n`);

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

const createRecipeApi = (req, res) => {
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
  let frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
`;
  if (source) frontmatter += `source: ${source}\n`;
  if (image) frontmatter += `image: ${image}\n`;
  frontmatter += `created: ${now}\n`;
  frontmatter += `updated: ${now}\n`;
  frontmatter += `---

`;
  const fileContent = frontmatter + markdownContent;

  try {
    fs.writeFileSync(filePath, fileContent, "utf8");

    db.run("INSERT INTO recipes (name, path) VALUES (?, ?)", [slug, filePath], (err) => {
      if (err) {
        console.error("Error inserting new recipe into DB:", err);
        fs.unlinkSync(filePath); // Rollback file creation
        return res.status(500).json({ error: "Failed to save recipe to the database." });
      }
      // Añadimos una URL de redirección a la respuesta.
      // El cliente usará esta URL para recargar la página y ver la nueva receta.
      res.status(201).json({
        message: "Recipe created successfully",
        redirectUrl: `/?recipe=${slug}`,
      });
    });
  } catch (writeErr) {
    console.error("Error writing recipe file:", writeErr);
    return res.status(500).json({ error: "Failed to write recipe file." });
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

module.exports = {
  getHomePage,
  getShoppingListPage,
  getAllRecipesApi,
  getRecipeByIdApi,
  createRecipeApi,
  scrapeRecipeApi,
};
