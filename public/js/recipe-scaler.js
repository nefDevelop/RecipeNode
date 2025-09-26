document.addEventListener("DOMContentLoaded", () => {
  const scalerContainer = document.getElementById("servings-scaler");
  if (!scalerContainer) return;

  const servingsInput = document.getElementById("servings-input");
  const originalServings = parseInt(scalerContainer.dataset.originalServings, 10);
  const recipeContent = document.getElementById("recipe-content-wrapper");

  if (!servingsInput || !originalServings || !recipeContent) return;

  // Almacenar el texto original de cada ingrediente, buscando solo dentro del artículo
  const ingredientElements = recipeContent.querySelectorAll("article ul li");
  ingredientElements.forEach((li) => {
    li.dataset.originalText = li.innerHTML;
  });

  // --- Reubicación del Escalador ---
  // Mover el escalador para que aparezca justo después del encabezado de "Ingredientes".
  const recipeArticle = recipeContent.querySelector("article.prose");
  if (recipeArticle) {
    const headings = recipeArticle.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let ingredientsHeading = null;
    for (const heading of headings) {
      const headingText = heading.textContent.toLowerCase();
      if (headingText.includes("ingredientes") || headingText.includes("ingredients")) {
        ingredientsHeading = heading;
        break; // Encontramos el primer encabezado de ingredientes
      }
    }

    if (ingredientsHeading) {
      // Inserta el contenedor del escalador justo después del encabezado encontrado.
      ingredientsHeading.parentNode.insertBefore(scalerContainer, ingredientsHeading.nextSibling);
    }
  }

  const scaleIngredients = () => {
    const newServings = parseInt(servingsInput.value, 10);
    if (isNaN(newServings) || newServings <= 0) return;

    const ratio = newServings / originalServings;

    ingredientElements.forEach((li) => {
      const originalText = li.dataset.originalText;
      if (!originalText) return;

      // Regex mejorada para encontrar números, fracciones (1/2) y rangos (2-3)
      const scaledText = originalText.replace(/(\d+[\.,\/]?\d*)\s*-\s*(\d+[\.,\/]?\d*)|(\d+[\.,\/]?\d*)/g, (match) => {
        // Función para convertir a número (maneja "1/2", "1,5", etc.)
        const parseNumber = (str) => {
          if (str.includes("/")) {
            const parts = str.split("/");
            return parseFloat(parts[0]) / parseFloat(parts[1]);
          }
          return parseFloat(str.replace(",", "."));
        };

        // Función para formatear el número de vuelta a un string legible
        const formatNumber = (num) => {
          if (num === 0) return "0";
          // Si es casi un entero, redondearlo
          if (Math.abs(num - Math.round(num)) < 0.01) {
            return Math.round(num).toString();
          }
          // Para fracciones comunes
          if (Math.abs(num - 0.25) < 0.01) return "1/4";
          if (Math.abs(num - 0.5) < 0.01) return "1/2";
          if (Math.abs(num - 0.75) < 0.01) return "3/4";
          // Otros decimales, con máximo 2 cifras
          return parseFloat(num.toFixed(2)).toString().replace(".", ",");
        };

        const numbers = match.split("-").map((s) => s.trim());
        const scaledNumbers = numbers.map((numStr) => {
          const num = parseNumber(numStr);
          return isNaN(num) ? numStr : formatNumber(num * ratio);
        });

        return scaledNumbers.join(" - ");
      });
      li.innerHTML = scaledText;
    });
  };

  servingsInput.addEventListener("input", scaleIngredients);

  // Botones + y -
  const minusBtn = document.getElementById("servings-minus");
  const plusBtn = document.getElementById("servings-plus");

  if (minusBtn) {
    minusBtn.addEventListener("click", () => {
      let currentValue = parseInt(servingsInput.value, 10);
      if (currentValue > 1) {
        servingsInput.value = currentValue - 1;
        scaleIngredients();
      }
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener("click", () => {
      let currentValue = parseInt(servingsInput.value, 10);
      servingsInput.value = currentValue + 1;
      scaleIngredients();
    });
  }
});
