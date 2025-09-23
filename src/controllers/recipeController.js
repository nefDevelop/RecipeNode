const fs = require("fs").promises;
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

const getAllRecipeTitles = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM recipes ORDER BY name", [], (err, rows) => {
      if (err) {
        console.error("Error al cargar los títulos de las recetas:", err);
        return reject("Error al cargar la lista de recetas desde la base de datos.");
      }
      const recipeTitles = rows.map((r) => r.name);
      resolve(recipeTitles);
    });
  });
};

/**
 * Extrae la primera imagen de un contenido Markdown.
 * Soporta formatos ![alt](url) y ![[obsidian_link]].
 * @param {string} markdownContent - El contenido del archivo markdown.
 * @returns {string|null} La URL de la imagen o null si no se encuentra.
 */
function extractImageFromMarkdown(markdownContent) {
  if (!markdownContent) return null;

  // 1. Regex para el formato de Obsidian: ![[imagen.jpg]] o ![[carpeta/imagen.jpg]]
  let match = markdownContent.match(/!\[\[(.*?)(?:\|.*)?\]\]/);
  if (match && match[1]) {
    const imageName = match[1].trim();
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

  // 2. Regex para el formato estándar de Markdown: !alt
  match = markdownContent.match(/!\[.*?\]\((.*?)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

const getHomePage = async (req, res) => {
  try {
    const recipeName = req.query.recipe;
    const recipeTitles = await getAllRecipeTitles();

    if (recipeName) {
      const recipeRow = await new Promise((resolve, reject) => {
        db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, row) => (err ? reject(err) : resolve(row)));
      });

      if (!recipeRow) {
        return res.render("index", {
          title: "Receta no encontrada",
          content: `La receta "${recipeName}" no existe.`,
          recipeTitles,
          recipes: null,
          user: req.session,
        });
      }

      const fileContent = await fs.readFile(recipeRow.path, "utf8");
      const { attributes, body: rawBody } = fm(fileContent);
      const body = rawBody.replace(/%%.*?%%/g, "");
      let htmlContent = marked.parse(body);
      htmlContent = htmlContent.replace(
        /!\[\[(.*?)\|(.*?)\]\]/g,
        (match, p1) => `<img src="${extractImageFromMarkdown(match)}" alt="Imagen de la receta" />`
      );
      htmlContent = htmlContent.replace(
        /!\[\[(.*?)\]\]/g,
        (match, p1) => `<img src="${extractImageFromMarkdown(match)}" alt="Imagen de la receta" />`
      );

      res.render("index", { title: attributes.title || recipeName, content: htmlContent, recipeTitles, recipes: null, user: req.session });
    } else {
      const allRecipes = await new Promise((resolve, reject) => {
        db.all("SELECT name, path FROM recipes ORDER BY name", [], (err, rows) => (err ? reject(err) : resolve(rows)));
      });

      const recipesWithImages = await Promise.all(
        allRecipes.map(async (recipe) => {
          try {
            const markdown = await fs.readFile(recipe.path, "utf8");
            const image = extractImageFromMarkdown(markdown);
            return { name: recipe.name, image };
          } catch (e) {
            return { name: recipe.name, image: null };
          }
        })
      );

      res.render("index", { title: "Recetas", content: null, recipes: recipesWithImages, recipeTitles, user: req.session });
    }
  } catch (error) {
    console.error("Error al obtener la página de recetas:", error);
    res.status(500).send("Error interno del servidor");
  }
};

const getShoppingListPage = (req, res) => {
  res.render("shopping-list", { recipeTitles: [] });
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

const getRecipeByIdApi = (req, res) => {
  const recipeName = req.params.id;
  db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, recipe) => {
    if (err) {
      console.error(`API Error fetching recipe ${recipeName}:`, err);
      return res.status(500).json({ error: "Database error while fetching recipe." });
    }

    if (!recipe) {
      return res.status(404).json({ error: `Recipe "${recipeName}" not found.` });
    }

    try {
      const fileContent = fs.readFileSync(recipe.path, "utf8");
      const { attributes, body: rawBody } = fm(fileContent);

      const body = rawBody.replace(/%%.*?%%/g, "");
      let htmlContent = marked.parse(body);
      htmlContent = htmlContent.replace(/!\[\[(.*?)\|(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');
      htmlContent = htmlContent.replace(/!\[\[(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');

      res.json({
        id: recipeName,
        title: attributes.title || recipeName,
        attributes: attributes,
        contentHtml: htmlContent,
      });
    } catch (readErr) {
      console.error(`API Error reading recipe file ${recipe.path}:`, readErr);
      return res.status(500).json({ error: "Failed to read recipe file." });
    }
  });
};

const createRecipeApi = (req, res) => {
  const { title, markdownContent } = req.body;

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
  const frontmatter = `---
title: ${title}
created: ${now}
updated: ${now}
---

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
      res.status(201).json({ message: "Recipe created successfully", id: slug, title: title });
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
    const title = $("h1").first().text().trim();
    if (!title) {
      return res.status(400).json({ error: "Could not automatically find a title on the page." });
    }

    let markdownContent = `## Ingredientes\n\n`;
    // Try to find an ingredients list
    $("h2, h3")
      .filter((i, el) => $(el).text().toLowerCase().includes("ingrediente"))
      .first()
      .next("ul")
      .find("li")
      .each((i, el) => {
        markdownContent += `- ${$(el).text().trim()}\n`;
      });

    markdownContent += `\n## Instrucciones\n\n`;
    // Try to find an instructions list
    $("h2, h3")
      .filter((i, el) => $(el).text().toLowerCase().includes("preparaci") || $(el).text().toLowerCase().includes("instruccione"))
      .first()
      .nextAll()
      .each((i, el) => {
        if ($(el).is("h2, h3")) return false; // Stop if we hit the next section
        if ($(el).is("p, ol, ul")) {
          $(el)
            .find("li")
            .each((li_idx, li_el) => {
              markdownContent += `${li_idx + 1}. ${$(li_el).text().trim()}\n`;
            });
          if ($(el).is("p")) {
            markdownContent += `${$(el).text().trim()}\n\n`;
          }
        }
      });

    // --- File and DB Creation (similar to createRecipeApi) ---
    const slug = slugify(title);
    const filename = `${slug}.md`;
    const recipesPath = path.join(__dirname, "../../recetas");
    const filePath = path.join(recipesPath, filename);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: `A recipe with the title "${title}" already exists.` });
    }

    const now = new Date().toISOString();
    const frontmatter = `---
title: ${title}
source: ${url}
created: ${now}
updated: ${now}
---

`;
    const fileContent = frontmatter + markdownContent;

    fs.writeFileSync(filePath, fileContent, "utf8");
    db.run("INSERT INTO recipes (name, path) VALUES (?, ?)", [slug, filePath]);

    res.status(201).json({ message: "Recipe scraped and created successfully", id: slug, title: title });
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
  getAllRecipeTitles,
};
