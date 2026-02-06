document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("recipe-search-input");
  const searchResultsContainer = document.getElementById("search-results");
  const recipeGallery = document.getElementById("recipe-gallery");
  const filterOptionsContainer = document.getElementById("filter-options");
  const filterToggleButton = document.getElementById("filter-toggle-btn");

  // Only initialize if the search input is present
  if (!searchInput) {
    console.log("Search input not found. Exiting sidebar-search.js initialization.");
    return;
  }

  let activeIndex = -1;
  let dynamicFilters = {}; // To store references to dynamically created filter elements
  let initialLoadComplete = false;

  // Función para generar el HTML de una tarjeta de receta
  const generateRecipeCardHtml = (recipe) => {
    const imageUrl = recipe.image || "";
    const placeholderStyle = recipe.image ? "display: none;" : "display: flex;";
    const displaySettings = window.recipeCardDisplaySettings || {}; // Get display settings

    let cardContentHtml = ``;

    if (displaySettings.image) {
      cardContentHtml += `
          <div class="relative pb-[75%] bg-green-100">
            ${
              imageUrl
                ? `<img src="${imageUrl}" alt="${recipe.name}" class="absolute h-full w-full object-cover" onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder').style.display='flex';"/>`
                : ``
            }
            <div
              class="placeholder absolute h-full w-full bg-green-100 dark:bg-green-900 items-center justify-center"
              style="${placeholderStyle}"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-12 h-12 text-green-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        `;
    }

    cardContentHtml += `<div class="p-4">`;

    if (displaySettings.name) {
      cardContentHtml += `
          <h3
            class="font-semibold text-lg text-gray-800 dark:text-gray-200 group-hover:text-green-600 truncate"
            title="${recipe.name}"
          >
            ${recipe.name}
          </h3>
        `;
    }

    // Contenedor de metadatos (Grid)
    cardContentHtml += `<div class="recipe-meta-grid mt-2">`;

    if (displaySettings.difficulty && recipe.difficulty) {
      cardContentHtml += `
          <div class="meta-item" title="Dificultad">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>${recipe.difficulty}</span>
          </div>
        `;
    }

    if (displaySettings.cookingTime && recipe.cooking_time) {
      cardContentHtml += `
          <div class="meta-item" title="Tiempo de cocción">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${recipe.cooking_time} min</span>
          </div>
        `;
    }

    if (displaySettings.cuisineType && recipe.cuisine_type) {
      cardContentHtml += `
          <div class="meta-item" title="Tipo de cocina">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span>${recipe.cuisine_type}</span>
          </div>
        `;
    }

    if (displaySettings.tags && recipe.tags && recipe.tags.length > 0) {
      cardContentHtml += `
          <div class="meta-item" title="Etiquetas">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span class="truncate max-w-[150px]">${recipe.tags.join(", ")}</span>
          </div>
        `;
    }

    if (displaySettings.mainIngredient && recipe.main_ingredient && recipe.main_ingredient.length > 0) {
      const ingredients = Array.isArray(recipe.main_ingredient) ? recipe.main_ingredient.join(", ") : recipe.main_ingredient;
      cardContentHtml += `
          <div class="meta-item" title="Ingrediente principal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="truncate max-w-[150px]">${ingredients}</span>
          </div>
        `;
    }

    if (displaySettings.equipment && recipe.equipment && recipe.equipment.length > 0) {
      const equipment = Array.isArray(recipe.equipment) ? recipe.equipment.join(", ") : recipe.equipment;
      cardContentHtml += `
          <div class="meta-item" title="Equipo necesario">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="truncate max-w-[150px]">${equipment}</span>
          </div>
        `;
    }

    cardContentHtml += `</div>`; // Cierre de recipe-meta-grid
    cardContentHtml += `</div>`; // Close p-4 div

    return `
        <div class="relative group">
          <a
            href="/?recipe=${encodeURIComponent(recipe.name)}"
            class="block bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
          >
            ${cardContentHtml}
          </a>
          <!-- Botón de Borrar (Solo para Admins) -->
          <!-- <% if (user && user.role === 'admin') { %> -->
          <!-- <button
            class="delete-recipe-btn absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            data-recipe-name="${recipe.name}"
            title="Eliminar receta"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </button> -->
          <!-- <% } %> -->
        </div>
      `;
  };
  // Function to fetch and display search suggestions in the dropdown
  const fetchAndDisplaySuggestions = async () => {
    const searchTerm = searchInput.value.toLowerCase();
    if (searchResultsContainer) {
      searchResultsContainer.innerHTML = ""; // Clear previous results
    }

    if (searchTerm.length > 2) {
      const params = new URLSearchParams();
      params.set("search", searchTerm);

      try {
        const response = await fetch(`/api/recipes/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();

        if (searchResultsContainer) {
          if (recipes.length > 0) {
            recipes.forEach((recipe) => {
              const link = document.createElement("a");
              link.href = `/?recipe=${encodeURIComponent(recipe.name)}`;
              link.textContent = recipe.name;
              link.classList.add(
                "flex",
                "items-center",
                "px-3",
                "py-2",
                "text-gray-700",
                "dark:text-gray-300",
                "hover:bg-gray-200",
                "dark:hover:bg-gray-700",
                "rounded-md",
              );
              searchResultsContainer.appendChild(link);
            });
            searchResultsContainer.style.display = "block";
          } else {
            searchResultsContainer.style.display = "none";
          }
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        if (searchResultsContainer) {
          searchResultsContainer.style.display = "none";
        }
      }
    } else {
      if (searchResultsContainer) {
        searchResultsContainer.style.display = "none";
      }
    }
    activeIndex = -1; // Reset selection on new suggestions
  };

  const filterRecipes = async () => {
    const searchTerm = searchInput.value.toLowerCase();
    const params = new URLSearchParams();

    if (searchTerm) {
      params.set("search", searchTerm);
    }

    // Collect values from dynamically created filters
    for (const key in dynamicFilters) {
      const filterElement = dynamicFilters[key];
      if (filterElement && filterElement.value) {
        params.set(key, filterElement.value);
      }
    }

    const newUrl = `/?${params.toString()}`;

    if (searchResultsContainer) {
      searchResultsContainer.innerHTML = ""; // Clear previous search results dropdown
      searchResultsContainer.style.display = "none"; // Ensure suggestions are hidden
    }

    // If recipeGallery is not present, redirect to the main recipe page with search parameters
    if (!recipeGallery) {
      window.location.href = newUrl;
      return;
    }

    // Update URL without reloading the page (only if on index.ejs)
    window.history.pushState({ path: newUrl }, "", newUrl);

    // Only fetch if there's a search term or active filters, or if we want to display all recipes
    const hasActiveFilters = searchTerm.length > 0 || Array.from(params.keys()).some((key) => key !== "search");

    if (hasActiveFilters) {
      try {
        const response = await fetch(`/api/recipes/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();

        let newGalleryContent = "";
        if (recipes.length > 0) {
          recipes.forEach((recipe) => {
            newGalleryContent += generateRecipeCardHtml(recipe);
          });
        } else {
          newGalleryContent =
            '<div class="text-center text-gray-500 col-span-full">No se encontraron recetas con los filtros aplicados.</div>';
        }
        recipeGallery.innerHTML = newGalleryContent;
      } catch (error) {
        console.error("Error fetching filtered recipes:", error);
        recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">Error al cargar recetas.</div>';
      }
    } else {
      // If no search term or filters, fetch and display all recipes
      try {
        const response = await fetch(`/api/recipes/search`); // Fetch all recipes
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();

        let newGalleryContent = "";
        if (recipes.length > 0) {
          recipes.forEach((recipe) => {
            newGalleryContent += generateRecipeCardHtml(recipe);
          });
        } else {
          newGalleryContent = '<div class="text-center text-gray-500 col-span-full">No hay recetas para mostrar. ¡Añade alguna!</div>';
        }
        recipeGallery.innerHTML = newGalleryContent;
      } catch (error) {
        console.error("Error fetching all recipes:", error);
        recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">Error al cargar recetas.</div>';
      }
    }
    activeIndex = -1; // Reset selection on new filter
  };

  // Function to fetch available filter options from the backend
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch("/api/recipes/filters");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const availableFilters = await response.json();
      renderFilters(availableFilters);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  // Function to dynamically render filter elements
  const renderFilters = (availableFilters) => {
    if (!filterOptionsContainer) return;

    // Clear existing dynamic filters
    filterOptionsContainer.innerHTML = "";
    dynamicFilters = {}; // Reset dynamic filters object

    const filterMapping = {
      cuisine_type: { label: "Cocina", param: "cuisine" },
      difficulty: { label: "Dificultad", param: "difficulty" },
      meal_type: { label: "Tipo de Comida", param: "meal_type" },
      rating: { label: "Calificación", param: "rating" },
      tags: { label: "Etiquetas", param: "tags" },
      main_ingredient: { label: "Ingrediente Principal", param: "main_ingredient" },
      equipment: { label: "Equipo", param: "equipment" },
    };

    const urlParams = new URLSearchParams(window.location.search);

    for (const field in filterMapping) {
      const { label, param } = filterMapping[field];
      const options = availableFilters[field];

      if (options && options.length > 0) {
        const filterDiv = document.createElement("div");
        filterDiv.className = "mb-4";

        const filterLabel = document.createElement("label");
        filterLabel.htmlFor = `filter-${param}`;
        filterLabel.className = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
        filterLabel.textContent = label;
        filterDiv.appendChild(filterLabel);

        const selectElement = document.createElement("select");
        selectElement.id = `filter-${param}`;
        selectElement.name = param;
        selectElement.className =
          "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100";
        selectElement.addEventListener("change", filterRecipes);

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = `Todas las ${label.toLowerCase()}`;
        selectElement.appendChild(defaultOption);

        options.forEach((option) => {
          const optionElement = document.createElement("option");
          optionElement.value = option;
          optionElement.textContent = option;
          selectElement.appendChild(optionElement);
        });

        // Set initial value from URL params
        if (urlParams.has(param)) {
          selectElement.value = urlParams.get(param);
        }

        filterDiv.appendChild(selectElement);
        filterOptionsContainer.appendChild(filterDiv);
        dynamicFilters[param] = selectElement; // Store reference
      }
    }

    // Handle cooking time filter separately as it's a range
    const cookingTimeFilterDiv = document.createElement("div");
    cookingTimeFilterDiv.className = "mb-4";
    cookingTimeFilterDiv.innerHTML = `
      <label for="cooking-time-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiempo Máximo de Cocción (min)</label>
      <input
        type="number"
        id="cooking-time-filter"
        name="time_max"
        placeholder="Ej. 60"
        class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
      />
    `;
    const cookingTimeFilterInput = cookingTimeFilterDiv.querySelector("#cooking-time-filter");
    if (cookingTimeFilterInput) {
      cookingTimeFilterInput.addEventListener("input", filterRecipes);
      if (urlParams.has("time_max")) {
        cookingTimeFilterInput.value = urlParams.get("time_max");
      }
      filterOptionsContainer.appendChild(cookingTimeFilterDiv);
      dynamicFilters["time_max"] = cookingTimeFilterInput; // Store reference
    }

    // Handle ingredients filter separately as it's a text input for multiple values
    const ingredientsFilterDiv = document.createElement("div");
    ingredientsFilterDiv.className = "mb-4";
    ingredientsFilterDiv.innerHTML = `
      <label for="ingredients-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ingredientes (separados por coma)</label>
      <input
        type="text"
        id="ingredients-filter"
        name="ingredients"
        placeholder="Ej. pollo, arroz"
        class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
      />
    `;
    const ingredientsFilterInput = ingredientsFilterDiv.querySelector("#ingredients-filter");
    if (ingredientsFilterInput) {
      ingredientsFilterInput.addEventListener("input", filterRecipes);
      if (urlParams.has("ingredients")) {
        ingredientsFilterInput.value = urlParams.get("ingredients");
      }
      filterOptionsContainer.appendChild(ingredientsFilterDiv);
      dynamicFilters["ingredients"] = ingredientsFilterInput; // Store reference
    }
  };

  // Initial population of filters from URL on page load
  const urlParams = new URLSearchParams(window.location.search);
  let filtersActiveOnLoad = false;

  if (urlParams.has("search")) {
    searchInput.value = urlParams.get("search");
    filtersActiveOnLoad = true;
  }
  // Check if any filter param is present in the URL, but ignore sort_by
  for (const param of urlParams.keys()) {
    if (param !== "search" && param !== "recipe" && param !== "sort_by") {
      filtersActiveOnLoad = true;
      break;
    }
  }

  // Event Listeners
  searchInput.addEventListener("input", fetchAndDisplaySuggestions);

  searchInput.addEventListener("keydown", (e) => {
    const currentRecipeLinks = Array.from(searchResultsContainer.getElementsByTagName("a"));
    const visibleLinks = currentRecipeLinks.filter((link) => link.style.display !== "none");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeIndex < visibleLinks.length - 1) {
        activeIndex++;
      } else {
        activeIndex = 0; // Loop to top
      }
      const realIndex = currentRecipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeIndex > 0) {
        activeIndex--;
      } else {
        activeIndex = visibleLinks.length - 1; // Loop to bottom
      }
      const realIndex = currentRecipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex > -1 && visibleLinks[activeIndex]) {
        visibleLinks[activeIndex].click();
      } else {
        // Only call filterRecipes if on the main gallery page
        if (recipeGallery) {
          filterRecipes();
        }
      }
    } else if (e.key === "Escape") {
      if (searchResultsContainer) {
        searchResultsContainer.style.display = "none";
      }
      if (filterOptionsContainer) {
        filterOptionsContainer.classList.add("hidden");
      }
      searchInput.blur();
    }
  });

  // Helper to update active class for keyboard navigation
  const updateActive = (newIndex) => {
    currentRecipeLinks.forEach((link, index) => {
      if (index === newIndex) {
        link.classList.add("bg-gray-200", "dark:bg-gray-700");
      } else {
        link.classList.remove("bg-gray-200", "dark:bg-gray-700");
      }
    });
  };

  // Ocultar resultados y filtros si se hace clic fuera
  document.addEventListener("click", (e) => {
    if (!initialLoadComplete) return;

    const isClickInsideSearch = searchInput.contains(e.target) || (searchResultsContainer && searchResultsContainer.contains(e.target));
    const isClickInsideFilter =
      filterToggleButton.contains(e.target) || (filterOptionsContainer && filterOptionsContainer.contains(e.target));

    if (!isClickInsideSearch) {
      if (searchResultsContainer) {
        searchResultsContainer.style.display = "none";
      }
    }

    if (!isClickInsideFilter) {
      if (filterOptionsContainer) {
        filterOptionsContainer.classList.add("hidden");
      }
    }
  });

  // Mostrar resultados al hacer focus
  searchInput.addEventListener("focus", () => {
    if (searchInput.value) {
      fetchAndDisplaySuggestions(); // Show suggestions on focus if there's input
    }
  });

  // --- Filter Toggle Functionality ---
  if (filterToggleButton && filterOptionsContainer) {
    filterToggleButton.addEventListener("click", () => {
      filterOptionsContainer.classList.toggle("hidden");
    });
  }

  // Initial state of filter options container
  if (filterOptionsContainer) {
    if (filtersActiveOnLoad) {
      filterOptionsContainer.classList.remove("hidden");
    } else {
      filterOptionsContainer.classList.add("hidden");
    }
  }

  // Fetch and render filters, then apply initial search/filters
  fetchFilterOptions().then(() => {
    initialLoadComplete = true; // Mark initial load as complete before rendering filters
    if (recipeGallery && filtersActiveOnLoad) {
      filterRecipes();
    }
  });
});
