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

const getHomePage = (req, res) => {
  db.all("SELECT name FROM recipes ORDER BY name", [], (err, recipeRows) => {
    if (err) {
      console.error("Error al cargar los títulos de las recetas:", err);
      return res.status(500).render("index", {
        user: req.session,
        recipeTitles: [],
        title: "Error",
        content: "No se pudo cargar la lista de recetas desde la base de datos.",
      });
    }
    const recipeTitles = recipeRows.map((r) => r.name);

    if (req.query.recipe) {
      const recipeName = req.query.recipe;
      db.get("SELECT path FROM recipes WHERE name = ?", [recipeName], (err, recipe) => {
        if (err) {
          console.error(`Error al buscar la receta ${recipeName}:`, err);
          return res.status(500).render("index", {
            user: req.session,
            recipeTitles,
            title: "Error",
            content: "Error al buscar la receta en la base de datos.",
          });
        }

        if (recipe) {
          try {
            const fileContent = fs.readFileSync(recipe.path, "utf8");
            const { attributes, body: rawBody } = fm(fileContent);
            const body = rawBody.replace(/%%.*?%%/g, "");
            let htmlContent = marked.parse(body);
            htmlContent = htmlContent.replace(/!\[\[(.*?)\|(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');
            htmlContent = htmlContent.replace(/!\[\[(.*?)\]\]/g, '<img src="/$1" alt="Imagen de la receta" />');

            return res.render("index", {
              title: attributes.title || recipeName,
              content: htmlContent,
              recipeTitles: recipeTitles,
              user: req.session,
            });
          } catch (readErr) {
            console.error(`Error al leer el archivo de receta ${recipe.path}:`, readErr);
            return res.status(500).render("index", {
              user: req.session,
              recipeTitles,
              title: "Error",
              content: "No se pudo leer el archivo de la receta.",
            });
          }
        } else {
          return res.render("index", {
            recipeTitles,
            title: "Receta no encontrada",
            user: req.session,
            content: `La receta "${recipeName}" no existe. Por favor, busca otra.`,
          });
        }
      });
    } else {
      res.render("index", {
        title: "Bienvenido",
        recipeTitles: recipeTitles,
        content: null,
        user: req.session,
      });
    }
  });
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
