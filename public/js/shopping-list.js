document.addEventListener("DOMContentLoaded", () => {
  // --- Selectores de Elementos ---
  const weeklyTab = document.getElementById("weekly-tab");
  const monthlyTab = document.getElementById("monthly-tab");
  const weeklySelector = document.getElementById("weekly-selector");
  const monthlySelector = document.getElementById("monthly-selector");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");
  const weekRangeDisplay = document.getElementById("week-range-display");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const monthDisplay = document.getElementById("month-display");
  const generateBtn = document.getElementById("generate-list-btn");
  const listContainer = document.getElementById("shopping-list-container");
  const listContent = document.getElementById("list-content");
  const pageTitle = document.getElementById("page-title");
  const generatorTitle = document.getElementById("generator-title");
  const manualListSection = document.getElementById("manual-list-section");
  const manualListItemsContainer = document.getElementById("manual-list-items"); // Contenedor UL de la lista manual
  const addManualItemForm = document.getElementById("add-manual-item-form");
  const manualItemInput = document.getElementById("manual-item-input");
  const addSeparatorBtn = document.getElementById("add-separator-btn");

  const STORAGE_KEY = "shoppingList";
  let currentMode = "weekly";
  let currentMonthDate = new Date();
  let currentWeekStartDate;

  // --- Funciones de persistencia de datos (Lista Generada) ---

  const saveListToStorage = (listData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listData));
  };

  const renderGeneratedList = (listData) => {
    // Aseguramos que 'ingredients' sea siempre un array,
    // ya sea que listData sea el array mismo o un objeto que lo contenga.
    const ingredients = Array.isArray(listData) ? listData : listData.ingredients;

    if (!ingredients || ingredients.length === 0) {
      listContainer.classList.add("hidden");
      return;
    }

    const itemsHtml = ingredients
      .map(
        (item) => `
          <li class="flex items-center py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md" data-item-text="${item.text}">
            <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 mr-3 ml-1" ${
              item.checked ? "checked" : ""
            }>
            <span class="flex-1">${item.text}</span>
          </li>
        `
      )
      .join("");
    listContent.innerHTML = `<ul class="list-none p-0">${itemsHtml}</ul>`;
    listContainer.classList.remove("hidden");
  };

  const loadListFromStorage = () => {
    const savedListJSON = localStorage.getItem(STORAGE_KEY);
    if (savedListJSON) {
      try {
        const savedList = JSON.parse(savedListJSON);
        // Aseguramos que renderGeneratedList reciba el array de ingredientes si está anidado
        const ingredientsToRender = savedList.ingredients || savedList;
        renderGeneratedList(ingredientsToRender);
        manualListSection.parentNode.insertBefore(manualListSection, generatorTitle);
        generatorTitle.textContent = "Generar Nueva Lista (reemplazará la actual)";
      } catch (e) {
        console.error("Error al parsear la lista de la compra guardada:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  // --- Funciones de UI (Generador) ---

  const updateWeekDisplay = () => {
    const startDate = new Date(currentWeekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const options = { day: "numeric", month: "long" };
    weekRangeDisplay.textContent = `Del ${startDate.toLocaleDateString("es-ES", options)} al ${endDate.toLocaleDateString(
      "es-ES",
      options
    )}`;
    weekRangeDisplay.dataset.startDate = startDate.toISOString().split("T")[0];
    weekRangeDisplay.dataset.endDate = endDate.toISOString().split("T")[0];
  };

  const setInitialWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    currentWeekStartDate = new Date(today.setDate(diff));
    currentWeekStartDate.setHours(0, 0, 0, 0);
    updateWeekDisplay();
  };

  const updateMonthDisplay = () => {
    monthDisplay.textContent = currentMonthDate
      .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase());
    monthDisplay.dataset.year = currentMonthDate.getFullYear();
    monthDisplay.dataset.month = currentMonthDate.getMonth();
  };

  const switchTab = (mode) => {
    currentMode = mode;
    weeklySelector.classList.toggle("hidden", mode !== "weekly");
    monthlySelector.classList.toggle("hidden", mode !== "monthly");
    [weeklyTab, monthlyTab].forEach((tab) => {
      const isActive = tab.id.startsWith(mode);
      tab.classList.toggle("border-green-600", isActive);
      tab.classList.toggle("text-green-600", isActive);
      tab.classList.toggle("bg-white", isActive);
      tab.classList.toggle("dark:bg-gray-800", isActive);
      tab.classList.toggle("bg-gray-100", !isActive);
      tab.classList.toggle("dark:bg-gray-700", !isActive);
      tab.classList.toggle("text-gray-500", !isActive);
      tab.classList.toggle("dark:text-gray-400", !isActive);
    });
  };

  // --- Lógica de la Lista Manual Compartida ---

  const renderManualList = (items) => {
    manualListItemsContainer.innerHTML = ""; // Limpiar antes de renderizar
    if (!items || items.length === 0) {
      manualListItemsContainer.innerHTML = '<li><p class="text-gray-500">No hay artículos en la lista manual.</p></li>';
      return;
    }
    items.forEach((item) => {
      // Detectar si el item es un separador
      const isSeparator = item.text.includes("---");

      const li = document.createElement("li");
      li.dataset.id = item.id;

      if (isSeparator) {
        li.className = "flex items-center justify-between py-2 my-2"; // Estilo para separador
        li.innerHTML = `
          <div class="flex-grow text-center text-gray-500 dark:text-gray-400 font-semibold tracking-wider">${item.text}</div>
          <button class="delete-manual-item-btn text-gray-400 hover:text-red-600 dark:hover:text-red-500 p-2 rounded-full flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        `;
      } else {
        li.className = "flex items-center justify-between py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"; // Estilo para item normal
        li.innerHTML = `
          <div class="flex items-center flex-grow">
            <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 mr-3 ml-1 manual-item-checkbox" ${
              item.checked ? "checked" : ""
            }>
            <span class="flex-1 ${item.checked ? "line-through text-gray-400" : ""}">${item.text}</span>
          </div>
          <button class="delete-manual-item-btn text-gray-400 hover:text-red-600 dark:hover:text-red-500 p-2 rounded-full flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        `;
      }
      manualListItemsContainer.appendChild(li);
    });
  };

  const fetchManualList = async () => {
    try {
      const response = await axios.get("/api/shopping-list/manual");
      renderManualList(response.data);
    } catch (error) {
      console.error("Error al cargar la lista manual:", error);
      manualListItemsContainer.innerHTML = '<li><p class="text-red-500">No se pudo cargar la lista.</p></li>';
    }
  };

  // Función helper para añadir un artículo (o separador) a la lista manual
  const addManualItemToList = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    try {
      await axios.post("/api/shopping-list/manual", { text: trimmedText });
      manualItemInput.value = ""; // Limpiar el input
      fetchManualList(); // Recargar la lista para mostrar el nuevo artículo
    } catch (error) {
      console.error("Error al añadir el artículo:", error);
      alert("No se pudo añadir el artículo.");
    }
  };

  // --- Event Listeners ---

  // Generador de lista
  prevWeekBtn.addEventListener("click", () => {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
    updateWeekDisplay();
  });
  nextWeekBtn.addEventListener("click", () => {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
    updateWeekDisplay();
  });
  weeklyTab.addEventListener("click", () => switchTab("weekly"));
  monthlyTab.addEventListener("click", () => switchTab("monthly"));
  prevMonthBtn.addEventListener("click", () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    updateMonthDisplay();
  });
  nextMonthBtn.addEventListener("click", () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    updateMonthDisplay();
  });

  generateBtn.addEventListener("click", async () => {
    if (localStorage.getItem(STORAGE_KEY) && !confirm("Esto reemplazará tu lista actual. ¿Estás seguro?")) {
      return;
    }

    let startDate, endDate;
    if (currentMode === "weekly") {
      startDate = new Date(weekRangeDisplay.dataset.startDate);
      endDate = new Date(weekRangeDisplay.dataset.endDate);
    } else {
      const year = parseInt(monthDisplay.dataset.year);
      const month = parseInt(monthDisplay.dataset.month);
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
    }
    const isoStartDate = startDate.toISOString().split("T")[0];
    const isoEndDate = endDate.toISOString().split("T")[0];

    listContainer.classList.remove("hidden");
    listContent.innerHTML = "<p>Generando lista...</p>";

    const response = await fetch(`/api/shopping-list?startDate=${isoStartDate}&endDate=${isoEndDate}`);
    const data = await response.json();

    if (!data || typeof data.ingredients === "undefined") {
      listContent.innerHTML = "<p>No se encontraron ingredientes para el periodo seleccionado o hubo un error.</p>";
      return;
    }

    // La API ahora devuelve un array plano de strings. Lo convertimos a objetos.
    const newListData = data.ingredients.map((itemText) => ({ text: itemText, checked: false }));
    saveListToStorage(newListData);
    renderGeneratedList(newListData); // Añadido para renderizar la lista
    manualListSection.parentNode.insertBefore(manualListSection, generatorTitle);
    generatorTitle.textContent = "Generar Nueva Lista (reemplazará la actual)";
    pageTitle.scrollIntoView({ behavior: "smooth" });
  });

  // Lista generada (marcar/desmarcar)
  listContent.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox && e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  listContent.addEventListener("change", (e) => {
    if (e.target.type === "checkbox") {
      const savedListJSON = localStorage.getItem(STORAGE_KEY);
      if (!savedListJSON) return;
      try {
        const listData = JSON.parse(savedListJSON);
        // Aseguramos que trabajamos con el array de ingredientes
        const ingredients = Array.isArray(listData) ? listData : listData.ingredients;
        const itemText = e.target.nextElementSibling.textContent;
        const item = ingredients.find((i) => i.text === itemText);
        if (item) {
          item.checked = e.target.checked;
        }
        saveListToStorage(ingredients); // Guardamos siempre el array plano
      } catch (err) {
        console.error("Error al actualizar el estado de la lista:", err);
      }
    }
  });

  // Lista Manual (Añadir, Marcar, Borrar)

  // Añadir un artículo normal al enviar el formulario
  addManualItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addManualItemToList(manualItemInput.value);
  });

  // Añadir un separador con el nuevo botón
  addSeparatorBtn.addEventListener("click", async () => {
    const text = manualItemInput.value.trim();
    let separatorText;

    if (text) {
      // Si hay texto, lo usamos como cabecera del separador
      separatorText = `${"-".repeat(5)} ${text} ${"-".repeat(5)}`;
    } else {
      // Si no hay texto, es solo una línea
      separatorText = "-".repeat(30);
    }
    // Llamamos a la función helper para añadir el separador a la lista
    await addManualItemToList(separatorText);
  });

  manualListItemsContainer.addEventListener("click", async (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const id = li.dataset.id;
    const checkbox = li.querySelector(".manual-item-checkbox");

    // Si es un separador (no tiene checkbox) y no se está borrando, no hacer nada.
    if (!checkbox && !e.target.closest(".delete-manual-item-btn")) return;

    if (e.target.closest(".delete-manual-item-btn")) {
      // Lógica para el botón de borrar
      if (confirm("¿Estás seguro de que quieres eliminar este artículo?")) {
        try {
          await axios.delete(`/api/shopping-list/manual/${id}`);
          fetchManualList();
        } catch (error) {
          console.error("Error al eliminar el artículo:", error);
          alert("No se pudo eliminar el artículo.");
        }
      }
    } else {
      // Lógica para marcar/desmarcar al hacer clic en cualquier otra parte del <li>
      // Si el clic no fue directamente en el checkbox, invertimos su estado
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      try {
        await axios.put(`/api/shopping-list/manual/${id}`, { checked: checkbox.checked });
        li.querySelector("span").classList.toggle("line-through", checkbox.checked);
        li.querySelector("span").classList.toggle("text-gray-400", checkbox.checked);
      } catch (error) {
        console.error("Error al actualizar el artículo:", error);
        alert("No se pudo actualizar el artículo.");
        checkbox.checked = !checkbox.checked; // Revertir en caso de error
      }
    }
  });

  // --- Drag and Drop para la Lista Manual ---
  new Sortable(manualListItemsContainer, {
    animation: 150,
    ghostClass: "sortable-ghost",
    onEnd: function (evt) {
      const items = manualListItemsContainer.querySelectorAll("li");
      const orderedIds = Array.from(items).map((item) => item.dataset.id);

      axios
        .put("/api/shopping-list/manual/order", { orderedIds })
        .then((response) => console.log(response.data.message))
        .catch((err) => console.error("Error al guardar el orden:", err));
    },
  });

  // --- Inicialización ---
  loadListFromStorage();
  setInitialWeek();
  updateMonthDisplay();
  switchTab("weekly");
  fetchManualList();
});
