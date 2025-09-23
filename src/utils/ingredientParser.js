const UNIT_ALIASES = {
  g: ["g", "gr", "gramo", "gramos"],
  kg: ["kg", "kilo", "kilos", "kilogramo", "kilogramos"],
  ml: ["ml", "mililitro", "mililitros"],
  l: ["l", "litro", "litros"],
  cda: ["cda", "cucharada", "cucharadas", "tbsp"],
  cdta: ["cdta", "cucharadita", "cucharaditas", "tsp"],
  taza: ["taza", "tazas", "cup", "cups"],
  unidad: ["unidad", "unidades", "ud", "uds"],
};

const ALIAS_TO_UNIT = Object.entries(UNIT_ALIASES).reduce((acc, [standard, aliases]) => {
  aliases.forEach((alias) => (acc[alias] = standard));
  return acc;
}, {});

const ALL_UNIT_ALIASES_REGEX = new RegExp(`\\b(${Object.values(UNIT_ALIASES).flat().join("|")})\\b`, "i");

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
  if (!quantityStr) return 1;
  quantityStr = quantityStr.trim().replace(",", ".");
  if (quantityStr.includes("/")) {
    const [num, den] = quantityStr.split("/").map(parseFloat);
    if (den) return num / den;
  }
  const num = parseFloat(quantityStr);
  return isNaN(num) ? 1 : num;
}

function parseIngredient(line) {
  line = line.trim();
  const quantityRegex = /^(\d+[\.,\/]?\d*|\d+)/;
  let quantityStr = line.match(quantityRegex)?.[0];
  let rest = quantityStr ? line.substring(quantityStr.length).trim() : line;

  const quantity = parseQuantity(quantityStr);

  let unitMatch = rest.match(ALL_UNIT_ALIASES_REGEX);
  let unit = "unidad";
  let name = rest;

  if (unitMatch) {
    unit = ALIAS_TO_UNIT[unitMatch[0].toLowerCase()];
    name = rest.replace(unitMatch[0], "").trim();
  }

  name = name.replace(/^de\s+/i, "").trim();

  // Basic singularization for countable items
  if (unit === "unidad" && quantity > 1 && name.split(" ").length === 1) {
    if (name.endsWith("es")) name = name.slice(0, -2);
    else if (name.endsWith("s")) name = name.slice(0, -1);
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
