document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("recipe-search-input");
  const searchResultsContainer = document.getElementById("search-results");
  const recipeGallery = document.getElementById("recipe-gallery");

  // Only initialize if the search input is present
  if (!searchInput) {
    console.log("Search input not found. Exiting sidebar-search.js initialization.");
    return;
  }

  console.log("searchInput:", searchInput);
  console.log("searchResultsContainer:", searchResultsContainer);
  console.log("recipeGallery:", recipeGallery);

  let activeIndex = -1;

  const cookingTimeFilter = document.getElementById("cooking-time-filter");
  const ingredientsFilter = document.getElementById("ingredients-filter");
  const cuisineFilter = document.getElementById("cuisine-filter");

  // Función para generar el HTML de una tarjeta de receta
  const generateRecipeCardHtml = (recipe) => {
    const imageUrl = recipe.image || ""; // Default to empty string if no image
    const placeholderStyle = recipe.image ? "display: none;" : "display: flex;";

    return `
      <div class="relative group">
        <a
          href="/?recipe=${encodeURIComponent(recipe.name)}"
          class="block bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
        >
          <div class="relative pb-[75%] bg-green-100">
            ${imageUrl ? `<img src="${imageUrl}" alt="${recipe.name}" class="absolute h-full w-full object-cover" onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder').style.display='flex';"/>` : ``}
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
          <div class="p-4">
            <h3
              class="font-semibold text-lg text-gray-800 dark:text-gray-200 group-hover:text-green-600 truncate"
              title="${recipe.name}"
            >
              ${recipe.name}
            </h3>
          </div>
        </a>
        <!-- Botón de Borrar (Solo para Admins) -->
        <!-- Assuming user and user.role are available globally or passed differently if needed -->
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
    console.log("fetchAndDisplaySuggestions called");
    const searchTerm = searchInput.value.toLowerCase();
    if (searchResultsContainer) {
      searchResultsContainer.innerHTML = ''; // Clear previous results
    }

    if (searchTerm.length > 2) {
      console.log("Fetching suggestions for: ", searchTerm);
      const params = new URLSearchParams();
      params.set("search", searchTerm);

      try {
        const response = await fetch(`/api/recipes/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();
        console.log("Suggestions API response:", recipes);

        if (searchResultsContainer) {
          if (recipes.length > 0) {
            recipes.forEach(recipe => {
              const link = document.createElement('a');
              link.href = `/?recipe=${encodeURIComponent(recipe.name)}`;
              link.textContent = recipe.name;
              link.classList.add("flex", "items-center", "px-3", "py-2", "text-gray-700", "dark:text-gray-300", "hover:bg-gray-200", "dark:hover:bg-gray-700", "rounded-md");
              searchResultsContainer.appendChild(link);
            });
            searchResultsContainer.style.display = "block";
            console.log("Suggestions displayed.");
          } else {
            searchResultsContainer.style.display = "none";
            console.log("No suggestions found.");
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
      console.log("Search term too short for suggestions.");
    }
    activeIndex = -1; // Reset selection on new suggestions
  };

  const filterRecipes = async () => {
    console.log("filterRecipes called");
    const searchTerm = searchInput.value.toLowerCase();
    const params = new URLSearchParams();

    if (searchTerm) {
      params.set("search", searchTerm);
    }
    if (cookingTimeFilter && cookingTimeFilter.value) {
      params.set("time_max", cookingTimeFilter.value);
    }
    if (ingredientsFilter && ingredientsFilter.value) {
      params.set("ingredients", ingredientsFilter.value);
    }
    if (cuisineFilter && cuisineFilter.value) {
      params.set("cuisine", cuisineFilter.value);
    }

    const newUrl = `/?${params.toString()}`;

    if (searchResultsContainer) {
      searchResultsContainer.innerHTML = ''; // Clear previous search results dropdown
      searchResultsContainer.style.display = "none"; // Ensure suggestions are hidden
    }

    // If recipeGallery is not present, redirect to the main recipe page with search parameters
    if (!recipeGallery) {
      console.log("Recipe gallery not found, redirecting to main page with search.");
      window.location.href = newUrl;
      return;
    }

    // Update URL without reloading the page (only if on index.ejs)
    window.history.pushState({ path: newUrl }, '', newUrl);
    console.log("URL updated to:", newUrl);

    // Only fetch if there's a search term or active filters, or if we want to display all recipes
    const hasActiveFilters = searchTerm.length > 0 || (cookingTimeFilter && cookingTimeFilter.value) || (ingredientsFilter && ingredientsFilter.value) || (cuisineFilter && cuisineFilter.value);

    if (hasActiveFilters) {
      console.log("Fetching filtered recipes for: ", params.toString());
      try {
        const response = await fetch(`/api/recipes/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();
        console.log("Filtered recipes API response:", recipes);

        recipeGallery.innerHTML = ''; // Clear existing recipes in the gallery
        if (recipes.length > 0) {
          recipes.forEach(recipe => {
            recipeGallery.insertAdjacentHTML('beforeend', generateRecipeCardHtml(recipe));
          });
          console.log("Recipe gallery updated with filtered recipes.");
        } else {
          recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">No se encontraron recetas con los filtros aplicados.</div>';
          console.log("No filtered recipes found.");
        }
      } catch (error) {
        console.error("Error fetching filtered recipes:", error);
        recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">Error al cargar recetas.</div>';
      }
    } else {
      // If no search term or filters, fetch and display all recipes
      console.log("No search term or filters, fetching all recipes.");
      try {
        const response = await fetch(`/api/recipes/search`); // Fetch all recipes
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();
        console.log("All recipes API response:", recipes);

        recipeGallery.innerHTML = ''; // Clear existing recipes in the gallery
        if (recipes.length > 0) {
          recipes.forEach(recipe => {
            recipeGallery.insertAdjacentHTML('beforeend', generateRecipeCardHtml(recipe));
          });
          console.log("Recipe gallery updated with all recipes.");
        } else {
          recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">No hay recetas para mostrar. ¡Añade alguna!</div>';
          console.log("No recipes found in database.");
        }
      } catch (error) {
        console.error("Error fetching all recipes:", error);
        recipeGallery.innerHTML = '<div class="text-center text-gray-500 col-span-full">Error al cargar recetas.</div>';
      }
    }
    activeIndex = -1; // Reset selection on new filter
  };

  // Initial population of filters from URL on page load
  const urlParams = new URLSearchParams(window.location.search);
  let filtersActiveOnLoad = false;

  if (urlParams.has("search")) {
    searchInput.value = urlParams.get("search");
    filtersActiveOnLoad = true;
  }
  if (cookingTimeFilter && urlParams.has("time_max")) {
    cookingTimeFilter.value = urlParams.get("time_max");
    filtersActiveOnLoad = true;
  }
  if (ingredientsFilter && urlParams.has("ingredients")) {
    ingredientsFilter.value = urlParams.get("ingredients");
    filtersActiveOnLoad = true;
  }
  if (cuisineFilter && urlParams.has("cuisine")) {
    cuisineFilter.value = urlParams.get("cuisine");
    filtersActiveOnLoad = true;
  }

  // If filters were active on load, perform an initial search
  if (filtersActiveOnLoad) {
    console.log("Filters active on load, performing initial filterRecipes call.");
    filterRecipes();
  } else if (recipeGallery) {
    // If no filters on load and on the main recipe page, ensure all recipes are displayed
    console.log("No filters active on load, and on recipe gallery page. Fetching all recipes.");
    filterRecipes(); // This will now fetch all recipes due to the change in filterRecipes logic
  }

  // Event Listeners
  searchInput.addEventListener("input", fetchAndDisplaySuggestions);
  if (cookingTimeFilter) cookingTimeFilter.addEventListener("change", filterRecipes);
  if (ingredientsFilter) ingredientsFilter.addEventListener("input", filterRecipes);
  if (cuisineFilter) cuisineFilter.addEventListener("change", filterRecipes);

  searchInput.addEventListener("keydown", (e) => {
    console.log("Keydown event detected: ", e.key);
    const currentRecipeLinks = Array.from(searchResultsContainer.getElementsByTagName("a"));
    const visibleLinks = currentRecipeLinks.filter((link) => link.style.display !== "none");
    console.log("Active index: ", activeIndex, "Visible links: ", visibleLinks.length);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeIndex < visibleLinks.length - 1) {
        activeIndex++;
      } else {
        activeIndex = 0; // Loop to top
      }
      const realIndex = currentRecipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
      console.log("ArrowDown - new activeIndex: ", activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeIndex > 0) {
        activeIndex--;
      } else {
        activeIndex = visibleLinks.length - 1; // Loop to bottom
      }
      const realIndex = currentRecipeLinks.indexOf(visibleLinks[activeIndex]);
      updateActive(realIndex);
      console.log("ArrowUp - new activeIndex: ", activeIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      console.log("Enter key pressed. Active index: ", activeIndex);
      if (activeIndex > -1 && visibleLinks[activeIndex]) {
        console.log("Clicking selected suggestion.");
        visibleLinks[activeIndex].click();
      } else {
        console.log("No suggestion selected, calling filterRecipes.");
        filterRecipes();
      }
    } else if (e.key === "Escape") {
      if (searchResultsContainer) {
        searchResultsContainer.style.display = "none";
      }
      if (filterOptionsContainer) {
        filterOptionsContainer.classList.add("hidden");
      }
      searchInput.blur();
      console.log("Escape key pressed, hiding suggestions and filters.");
    }
  });

  // Ocultar resultados y filtros si se hace clic fuera
  document.addEventListener("click", (e) => {
    const isClickInsideSearch = searchInput.contains(e.target) || (searchResultsContainer && searchResultsContainer.contains(e.target));
    const isClickInsideFilter = filterToggleButton.contains(e.target) || (filterOptionsContainer && filterOptionsContainer.contains(e.target));

    if (!isClickInsideSearch) {
      if (searchResultsContainer) {
        searchResultsContainer.style.display = "none";
      }
      console.log("Clicked outside search, hiding suggestions.");
    }

    if (!isClickInsideFilter) {
      if (filterOptionsContainer) {
        filterOptionsContainer.classList.add("hidden");
      }
      console.log("Clicked outside filter, hiding filters.");
    }
  });

  // Mostrar resultados al hacer focus
  searchInput.addEventListener("focus", () => {
    if (searchInput.value) {
      console.log("Search input focused, calling fetchAndDisplaySuggestions.");
      fetchAndDisplaySuggestions(); // Show suggestions on focus if there's input
    }
  });

  // --- Filter Functionality ---
  const filterToggleButton = document.getElementById("filter-toggle-btn");
  const filterOptionsContainer = document.getElementById("filter-options");

  console.log("filterToggleButton:", filterToggleButton);
  console.log("filterOptionsContainer:", filterOptionsContainer);

  if (filterToggleButton && filterOptionsContainer) {
    filterToggleButton.addEventListener("click", () => {
      filterOptionsContainer.classList.toggle("hidden");
      console.log("Filter toggle button clicked. Filter options hidden state: ", filterOptionsContainer.classList.contains("hidden"));
    });
  }

  // Initial state of filter options container
  // urlParams is already declared above
  let anyFilterParamPresent = false;
  if (urlParams.has("search") || (cookingTimeFilter && urlParams.has("time_max")) || (ingredientsFilter && urlParams.has("ingredients")) || (cuisineFilter && urlParams.has("cuisine"))) {
    anyFilterParamPresent = true;
  }

  if (filterOptionsContainer) {
    if (anyFilterParamPresent) {
      filterOptionsContainer.classList.remove("hidden");
      console.log("Filter options shown due to URL parameters.");
    } else {
      filterOptionsContainer.classList.add("hidden");
      console.log("Filter options hidden as no URL parameters present.");
    }
  }


});
