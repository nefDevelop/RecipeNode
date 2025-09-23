function extractIngredients(markdownBody) {
  const lines = markdownBody.split("\n");
  const ingredientHeaderKeywords = ["ingredientes", "ingredients"];

  let ingredientsSection = "";
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Check if the line is an ingredients header
    if (!inSection) {
      // Matches '# Ingredients', '## Ingredients', etc. or just 'Ingredients' on its own line
      const isHeader = lowerLine.startsWith("#") && ingredientHeaderKeywords.some((keyword) => lowerLine.includes(keyword));
      const isPlainTextHeader = ingredientHeaderKeywords.includes(lowerLine);

      if (isHeader || isPlainTextHeader) {
        inSection = true;
        // Don't add the header itself, start from the next line
        continue;
      }
    }

    if (inSection) {
      // If we find the next header, stop collecting.
      if (line.startsWith("#")) {
        break;
      }
      // Add the line to our section to be parsed later
      ingredientsSection += lines[i] + "\n"; // Use original line to preserve indentation for regex
    }
  }

  if (!ingredientsSection) {
    return [];
  }

  // Now parse the collected section for list items
  const ingredients = [];
  const listItemRegex = /^\s*-\s(?:\[[ x]\]\s)?(.*)/gm;
  let match;
  while ((match = listItemRegex.exec(ingredientsSection)) !== null) {
    const ingredient = match[1].trim();
    if (ingredient) {
      ingredients.push(ingredient);
    }
  }
  return ingredients;
}

module.exports = { extractIngredients };
