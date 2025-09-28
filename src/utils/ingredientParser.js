const UNIT_ALIASES = {
  g: ["g", "gr", "gramo", "gramos"],
  kg: ["kg", "kilo", "kilos", "kilogramo", "kilogramos"],
  ml: ["ml", "mililitro", "mililitros"],
  l: ["l", "litro", "litros"],
  cda: ["cda", "cucharada", "cucharadas", "tbsp"],
  cdta: ["cdta", "cucharadita", "cucharaditas", "tsp"],
  taza: ["taza", "tazas", "cup", "cups"],
  unidad: ["unidad", "unidades", "ud", "uds", "chorrito", "chorritos", "bolsa", "bolsas", "diente", "dientes", "pechuga", "pechugas", "gota", "gotas", "pizca", "pizcas", "vaso", "vasos"],
};

const ALIAS_TO_UNIT = Object.entries(UNIT_ALIASES).reduce((acc, [standard, aliases]) => {
  aliases.forEach((alias) => (acc[alias] = standard));
  return acc;
}, {});

// Create a regex that matches any of the unit aliases as whole words
const ALL_UNIT_ALIASES_REGEX = new RegExp(`\\b(${Object.values(UNIT_ALIASES).flat().sort((a, b) => b.length - a.length).join("|")})\\b`, "i");

const BASE_UNITS = {
  g: "weight",
  kg: "weight",
  ml: "volume",
  l: "volume",
  cda: "volume",
  cdta: "volume",
  taza: "volume",
  unidad: "count",
};

function parseQuantity(quantityStr) {
  if (!quantityStr) return null;
  quantityStr = quantityStr.trim().replace(",", ".");
  if (quantityStr.includes("/")) {
    const [num, den] = quantityStr.split("/").map(parseFloat);
    if (den && !isNaN(num) && !isNaN(den)) return num / den;
    return null; // If division results in NaN or invalid parts
  }
  const num = parseFloat(quantityStr);
  return isNaN(num) ? null : num;
}

function parseIngredient(line) {
  line = line.trim();

  // 1. Early and aggressive cleaning of special markers and descriptive phrases
  line = line.replace(/\*.*?\*/g, '').trim(); // Remove text within asterisks
  line = line.replace(/\[\[(.*?)\]\]/g, '$1').trim(); // Remove [[...]] but keep content
  line = line.replace(/\(.*\)/g, '').trim(); // Remove text within parentheses

  // Handle 'o' (or) conditions: take the first option if 'o' is a clear separator
  if (line.includes(' o ')) {
    const parts = line.split(' o ');
    // Only take the first part if it's not just a single word, to avoid splitting valid names
    if (parts[0].trim().split(' ').length > 0) {
      line = parts[0].trim();
    }
  }

  // 2. Extract Quantity
  const quantityRegex = /^(\d+[\.,\/]?\d*\s*(?:-\s*\d+[\.,\/]?\d*)?)/;
  let quantityStr = line.match(quantityRegex)?.[1];
  let rest = quantityStr ? line.substring(quantityStr.length).trim() : line;

  // Handle ranges: take the first number
  if (quantityStr && quantityStr.includes('-')) {
    quantityStr = quantityStr.split('-')[0].trim();
  }

  const quantity = parseQuantity(quantityStr);

  let unit = "unidad";
  let name = rest;

  // 3. Extract Unit
  // Sort aliases by length descending to match longer units first (e.g., 'cucharadita' before 'cda')
  const sortedUnitAliases = Object.values(UNIT_ALIASES).flat().sort((a, b) => b.length - a.length);
  // Regex to find unit, optionally preceded by prepositions/articles, at the start of 'rest'
  const unitRegex = new RegExp(`^(?:\b(?:de|del|la|el|un|una|unos|unas)\b\s*)*(${sortedUnitAliases.join("|")})\\b`, "i");
  let unitMatch = rest.match(unitRegex);

  if (unitMatch) {
    unit = ALIAS_TO_UNIT[unitMatch[1].toLowerCase()]; // unitMatch[1] is the captured unit alias
    // Remove the matched unit part (including preceding prepositions/articles) from 'rest'
    name = rest.substring(unitMatch[0].length).trim();
  }

  // 4. Clean up the remaining name
  // Remove leading/trailing prepositions/articles
  name = name.replace(/^(?:de|del|la|el|un|una|unos|unas)\s+/i, '').trim();
  name = name.replace(/\s+(?:de|del|la|el|un|una|unos|unas)$/i, '').trim();
  name = name.replace(/\s+/g, ' '); // Replace multiple spaces with a single space

  // Remove trailing punctuation (e.g., dot from 'cebolla.')
  name = name.replace(/[.,;]$/, '').trim();

  // Remove common adjectives and descriptive words that are not part of the core ingredient
  const commonAdjectives = ["grande", "maduro", "menor", "suaves", "enteras", "químicas", "fritos", "blancos", "molidos", "picadas", "verdes", "cocidos", "congelados", "laminados", "troceados", "floja", "repostería", "virgen extra", "negra", "ahumados", "dulces", "ibéricos", "para montar", "en polvo", "medianos", "blanquillas", "de todo uso", "de panadería", "de freír", "fundidas", "al gusto", "para un punto picante", "para acompañar", "jarabe de arce", "mantequilla", "crema de chocolate", "nutella", "nocilla", "fina", "de pollos", "de trigo", "de arroz", "de especias", "de comino", "de cúrcuma", "de pimentón", "de sal", "de vainilla", "de miel", "de agua", "de caldo", "de vino", "de lima", "de cebolla", "de pimiento", "de champiñón", "de guisantes", "de jamón", "de nata", "de levadura", "de queso", "de harina", "de tomate", "de nachos", "de totopos", "de ajo", "de pimentón", "de azúcar", "de pera", "de huevo", "de pan", "de garbanzo", "de carne", "de maíz", "de zanahoria", "de vinagre", "de aceite", "de canela", "de limón", "de perejil", "de cilantro", "de pimienta", "de sal", "de frijol", "de alubia", "cocidas", "negros", "rojos", "mejor si son"];
  const adjectiveRegex = new RegExp(`\\b(?:${commonAdjectives.join("|")})\\b`, "ig");
  name = name.replace(adjectiveRegex, '').trim();

  // Remove extra spaces after adjective removal
  name = name.replace(/\s+/g, ' ').trim();

  // 5. Refine Singularization for Spanish words
  if (name) {
    // More aggressive singularization for common Spanish plural endings
    if (name.endsWith("es")) {
      name = name.slice(0, -2);
    } else if (name.endsWith("s") && !name.endsWith("ss")) {
      name = name.slice(0, -1);
    }
    // Specific singularization for some words
    if (name === "aj") name = "ajo";
    if (name === "tomat") name = "tomate";
    if (name === "cebolla") name = "cebolla"; // Ensure it doesn't become ceboll
    if (name === "pimiento") name = "pimiento";
    if (name === "huevo") name = "huevo";
    if (name === "pollo") name = "pollo";
    if (name === "garbanzo") name = "garbanzo";
    if (name === "zanahoria") name = "zanahoria";
    if (name === "pera") name = "pera";
    if (name === "frijol") name = "frijol";
    if (name === "alubia") name = "alubia";
    if (name === "champiñón") name = "champiñón";
    if (name === "guisante") name = "guisante";
    if (name === "jamón") name = "jamón";
    if (name === "nata") name = "nata";
    if (name === "levadura") name = "levadura";
    if (name === "queso") name = "queso";
    if (name === "harina") name = "harina";
    if (name === "tomate") name = "tomate";
    if (name === "nacho") name = "nacho";
    if (name === "totopo") name = "totopo";
    if (name === "pimentón") name = "pimentón";
    if (name === "azúcar") name = "azúcar";
    if (name === "comino") name = "comino";
    if (name === "cúrcuma") name = "cúrcuma";
    if (name === "tabasco") name = "tabasco";
    if (name === "vinagre") name = "vinagre";
    if (name === "aceite") name = "aceite";
    if (name === "canela") name = "canela";
    if (name === "limón") name = "limón";
    if (name === "perejil") name = "perejil";
    if (name === "cilantro") name = "cilantro";
    if (name === "pimienta") name = "pimienta";
    if (name === "sal") name = "sal";
    if (name === "esencia") name = "esencia";
    if (name === "miel") name = "miel";
    if (name === "agua") name = "agua";
    if (name === "caldo") name = "caldo";
    if (name === "vino") name = "vino";
    if (name === "lima") name = "lima";
    if (name === "pan") name = "pan";
    if (name === "maíz") name = "maíz";
    if (name === "salsa") name = "salsa";
  }

  return { quantity, unit, name: name || "ingrediente desconocido" };
}

function normalizeIngredient(parsed, conversions) {
  const { quantity, unit, name } = parsed;
  const category = BASE_UNITS[unit];

  if (category === "weight") {
    let baseQuantity = quantity;
    if (unit === "kg") baseQuantity = quantity * (conversions["kg-to-g"] || 1000);
    return { name, quantity: baseQuantity, baseUnit: "g" };
  }

  if (category === "volume") {
    let baseQuantity = quantity;
    if (unit === "l") baseQuantity = quantity * (conversions["l-to-ml"] || 1000);
    else if (unit === "taza") baseQuantity = quantity * (conversions["cup-to-ml"] || 240);
    else if (unit === "cda") baseQuantity = quantity * (conversions["tbsp-to-ml"] || 15);
    else if (unit === "cdta") baseQuantity = quantity * (conversions["tsp-to-ml"] || 5);
    return { name, quantity: baseQuantity, baseUnit: "ml" };
  }

  return { name, quantity, baseUnit: "unidad" };
}

module.exports = { parseIngredient, normalizeIngredient };
