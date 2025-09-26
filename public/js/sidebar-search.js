document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("recipe-search-input");
  const searchResultsContainer = document.getElementById("search-results");
  const recipeLinks = Array.from(searchResultsContainer.getElementsByTagName("a"));
  let activeIndex = -1;

  if (!searchInput || !searchResultsContainer) {
    return;
  }

  // Función para filtrar la lista de recetas
  const filterRecipes = () => {
    const filter = searchInput.value.toLowerCase();
    let hasResults = false;
    recipeLinks.forEach((link) => {
      const text = link.textContent.toLowerCase();
      if (text.includes(filter)) {
        link.style.display = "";
        hasResults = true;
      } else {
        link.style.display = "none";
      }
    });
    searchResultsContainer.style.display = hasResults && filter ? "block" : "none";
    activeIndex = -1; // Reset selection on new filter
  };

  // Función para actualizar el elemento activo en la lista
  const updateActive = () => {
    recipeLinks.forEach((link, index) => {
      if (index === activeIndex) {
        link.classList.add("bg-gray-200", "dark:bg-gray-600");
        link.scrollIntoView({ block: "nearest" });
      } else {
        link.classList.remove("bg-gray-200", "dark:bg-gray-600");
      }
    });
  };

  searchInput.addEventListener("input", filterRecipes);

  searchInput.addEventListener("keydown", (e) => {
    const visibleLinks = recipeLinks.filter((link) => link.style.display !== "none");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeIndex < visibleLinks.length - 1) {
        activeIndex++;
      } else {
        activeIndex = 0; // Loop to top
      }
      const realIndex = recipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeIndex > 0) {
        activeIndex--;
      } else {
        activeIndex = visibleLinks.length - 1; // Loop to bottom
      }
      const realIndex = recipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex > -1 && visibleLinks[activeIndex]) {
        visibleLinks[activeIndex].click();
      }
    } else if (e.key === "Escape") {
      searchResultsContainer.style.display = "none";
      searchInput.blur();
    }
  });

  // Ocultar resultados si se hace clic fuera
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
      searchResultsContainer.style.display = "none";
    }
  });

  // Mostrar resultados al hacer focus
  searchInput.addEventListener("focus", () => {
    if (searchInput.value) {
      filterRecipes();
    }
  });
});
