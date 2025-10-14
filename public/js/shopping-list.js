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
  const clearGeneratedListBtn = document.getElementById("clear-generated-list-btn");
  const listContainer = document.getElementById("shopping-list-container");
  const listContent = document.getElementById("list-content");
  const pageTitle = document.getElementById("page-title");
  const generatorTitle = document.getElementById("generator-title");
  const manualListSection = document.getElementById("manual-list-section");
  const manualItemInput = document.getElementById("manual-item-input");
  const toggleGeneratedDragBtn = document.getElementById("toggle-generated-drag-btn");
  const generatedDragLockedIcon = document.getElementById("generated-drag-locked-icon");
  const generatedDragUnlockedIcon = document.getElementById("generated-drag-unlocked-icon");
  const toggleManualDragBtn = document.getElementById("toggle-manual-drag-btn");
  const manualDragLockedIcon = document.getElementById("manual-drag-locked-icon");
  const manualDragUnlockedIcon = document.getElementById("manual-drag-unlocked-icon");

  // Nuevos selectores para la lista con pestañas
  const manualListTabsNav = document.getElementById("manual-list-tabs-nav");
  const manualListItemsContainer = document.getElementById("manual-list-items-container");
  const addManualItemForm = document.getElementById("add-manual-item-form");

  const STORAGE_KEY = "shoppingList";
  let currentMode = "weekly";
  let currentMonthDate = new Date();
  let currentWeekStartDate;
  let generatedListSortable = null;

  // --- Estado de la Lista Manual ---
  let manualListTabs = [];
  let manualListItems = [];
  let activeManualTabId = null;
  let manualListSortable = null;

  // --- WebSocket Connection ---
  const socket = io();

  // --- Funciones de persistencia de datos (Lista Generada) ---
  const setupGeneratedListDragToggle = () => {
    if (toggleGeneratedDragBtn && generatedListSortable) {
      toggleGeneratedDragBtn.replaceWith(toggleGeneratedDragBtn.cloneNode(true));
      const newToggleBtn = document.getElementById("toggle-generated-drag-btn");

      newToggleBtn.addEventListener("click", () => {
        const isDisabled = generatedListSortable.option("disabled");
        generatedListSortable.option("disabled", !isDisabled);

        document.getElementById("generated-drag-locked-icon").classList.toggle("hidden", isDisabled);
        document.getElementById("generated-drag-unlocked-icon").classList.toggle("hidden", !isDisabled);
        newToggleBtn.classList.toggle("bg-green-100", isDisabled);
        newToggleBtn.classList.toggle("dark:bg-green-900", isDisabled);
      });
    }
  };

  const saveListToStorage = (listData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listData));
  };

  const renderGeneratedList = (listData) => {
    const ingredients = Array.isArray(listData) ? listData : listData.ingredients;

    if (!ingredients || ingredients.length === 0) {
      listContainer.classList.add("hidden");
      clearGeneratedListBtn.classList.add("hidden");
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
    listContent.innerHTML = `<ul id="generated-list-ul" class="list-none p-0">${itemsHtml}</ul>`;
    listContainer.classList.remove("hidden");
    clearGeneratedListBtn.classList.remove("hidden");

    const generatedListUl = document.getElementById("generated-list-ul");
    if (generatedListUl) {
      generatedListSortable = new Sortable(generatedListUl, {
        animation: 150,
        ghostClass: "sortable-ghost",
        disabled: true,
        onEnd: function (evt) {
          const listItems = generatedListUl.querySelectorAll("li");
          const orderedTexts = Array.from(listItems).map((li) => li.dataset.itemText);
          const savedListJSON = localStorage.getItem(STORAGE_KEY);
          if (!savedListJSON) return;
          const listData = JSON.parse(savedListJSON);
          const ingredients = Array.isArray(listData) ? listData : listData.ingredients;
          const ingredientMap = new Map(ingredients.map((item) => [item.text, item]));
          const newListData = orderedTexts.map((text) => ingredientMap.get(text));
          saveListToStorage(newListData);
        },
      });
    }
    setupGeneratedListDragToggle();
  };

  const loadListFromStorage = () => {
    const savedListJSON = localStorage.getItem(STORAGE_KEY);
    if (savedListJSON) {
      try {
        const savedList = JSON.parse(savedListJSON);
        const ingredientsToRender = savedList.ingredients || savedList;
        renderGeneratedList(ingredientsToRender);
        generatorTitle.textContent = "Generar Nueva Lista (reemplazará la actual)";
        clearGeneratedListBtn.classList.remove("hidden");
      } catch (e) {
        console.error("Error al parsear la lista de la compra guardada:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  // --- Lógica de la Lista Manual Compartida (Reescrita para Pestañas) ---

  const escapeHTML = (str) => {
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  };

  const renderManualTabs = () => {
    manualListTabsNav.innerHTML = "";
    if (manualListTabs.length === 0) {
      manualListTabsNav.innerHTML = `<p class="text-gray-500 dark:text-gray-400 p-2">No hay pestañas. Créalas en <a href="/settings" class="text-green-600 hover:underline">Ajustes</a>.</p>`;
      addManualItemForm.classList.add("hidden");
      return;
    }
    addManualItemForm.classList.remove("hidden");

    const nav = document.createElement("nav");
    nav.className = "flex space-x-4";

    manualListTabs.forEach((tab) => {
      const button = document.createElement("button");
      button.dataset.tabId = tab.id;
      button.textContent = escapeHTML(tab.name);
      button.className = `manual-tab-btn py-2 px-4 font-semibold text-sm rounded-t-lg`;
      if (tab.id === activeManualTabId) {
        button.classList.add("border-b-2", "border-green-600", "text-green-600");
      } else {
        button.classList.add("text-gray-500", "hover:text-gray-700", "dark:text-gray-400", "dark:hover:text-gray-200");
      }
      nav.appendChild(button);
    });
    manualListTabsNav.appendChild(nav);
  };

  const renderManualItemLists = () => {
    manualListItemsContainer.innerHTML = "";
    manualListTabs.forEach((tab) => {
      const ul = document.createElement("ul");
      ul.id = `manual-list-tab-${tab.id}`;
      ul.className = "list-none p-0 manual-list-ul";
      if (tab.id !== activeManualTabId) {
        ul.classList.add("hidden");
      }

      const itemsForTab = manualListItems.filter((item) => item.tabId === tab.id);
      if (itemsForTab.length === 0) {
        ul.innerHTML = `<li><p class="text-gray-500 p-4">No hay artículos en esta pestaña.</p></li>`;
      } else {
        itemsForTab.forEach((item) => {
          const li = document.createElement("li");
          li.dataset.id = item.id;
          li.className = "flex items-center justify-between py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md";
          li.innerHTML = `
                    <div class="flex items-center flex-grow">
                        <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 mr-3 ml-1 manual-item-checkbox" ${
                          item.checked ? "checked" : ""
                        }>
                        <span class="flex-1 ${item.checked ? "line-through text-gray-400" : ""}">${escapeHTML(item.text)}</span>
                    </div>
                    <button class="delete-manual-item-btn text-gray-400 hover:text-red-600 dark:hover:text-red-500 p-2 rounded-full flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;
          ul.appendChild(li);
        });
      }
      manualListItemsContainer.appendChild(ul);
    });
    setupManualListDragAndDrop();
  };

  const switchManualTab = (tabId) => {
    activeManualTabId = tabId;
    renderManualTabs(); // Re-render tabs to update active state
    document.querySelectorAll(".manual-list-ul").forEach((ul) => {
      ul.classList.toggle("hidden", ul.id !== `manual-list-tab-${activeManualTabId}`);
    });
    setupManualListDragAndDrop(); // Re-initialize sortable for the new active list
  };

  const initManualList = async () => {
    try {
      const [tabsRes, itemsRes] = await Promise.all([axios.get("/api/tabs"), axios.get("/api/shopping-list/manual")]);

      manualListTabs = tabsRes.data;
      manualListItems = itemsRes.data;

      if (manualListTabs.length > 0 && !activeManualTabId) {
        activeManualTabId = manualListTabs[0].id;
      }

      renderManualTabs();
      renderManualItemLists();
    } catch (error) {
      console.error("Error al inicializar la lista manual:", error);
      manualListItemsContainer.innerHTML = `<li><p class="text-red-500">No se pudo cargar la lista de la compra manual.</p></li>`;
    }
  };

  const addManualItemToList = async (text, tabId) => {
    const trimmedText = text.trim();
    if (!trimmedText || !tabId) return;

    try {
      // La UI se actualizará a través del evento de socket
      await axios.post("/api/shopping-list/manual", { text: trimmedText, tabId });
      manualItemInput.value = "";
    } catch (error) {
      console.error("Error al añadir el artículo:", error);
      alert("No se pudo añadir el artículo.");
    }
  };

  const setupManualListDragAndDrop = () => {
    if (manualListSortable) {
      manualListSortable.destroy();
    }
    const activeList = document.getElementById(`manual-list-tab-${activeManualTabId}`);
    if (!activeList) return;

    manualListSortable = new Sortable(activeList, {
      animation: 150,
      ghostClass: "sortable-ghost",
      disabled: true, // Disabled by default
      onEnd: function (evt) {
        const items = activeList.querySelectorAll("li");
        const orderedIds = Array.from(items).map((item) => item.dataset.id);

        axios
          .put("/api/shopping-list/manual/order", { orderedIds, tabId: activeManualTabId })
          .catch((err) => console.error("Error al guardar el orden:", err));
      },
    });

    // Reset drag toggle state
    manualListSortable.option("disabled", true);
    manualDragLockedIcon.classList.remove("hidden");
    manualDragUnlockedIcon.classList.add("hidden");
    toggleManualDragBtn.classList.remove("bg-green-100", "dark:bg-green-900");
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

  // --- Event Listeners ---
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
    const newListData = data.ingredients.map((itemText) => ({ text: itemText, checked: false }));
    saveListToStorage(newListData);
    renderGeneratedList(newListData);
    generatorTitle.textContent = "Generar Nueva Lista (reemplazará la actual)";
    pageTitle.scrollIntoView({ behavior: "smooth" });
  });

  clearGeneratedListBtn.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres limpiar la lista de la compra generada? Esta acción no se puede deshacer.")) {
      localStorage.removeItem(STORAGE_KEY);
      listContainer.classList.add("hidden");
      listContent.innerHTML = "";
      clearGeneratedListBtn.classList.add("hidden");
      generatorTitle.textContent = "Generador de Lista de la Compra";
    }
  });

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
        const ingredients = Array.isArray(listData) ? listData : listData.ingredients;
        const itemText = e.target.nextElementSibling.textContent;
        const item = ingredients.find((i) => i.text === itemText);
        if (item) {
          item.checked = e.target.checked;
        }
        saveListToStorage(ingredients);
      } catch (err) {
        console.error("Error al actualizar el estado de la lista:", err);
      }
    }
  });

  // --- Event Listeners para la Lista Manual ---
  manualListTabsNav.addEventListener("click", (e) => {
    if (e.target.matches(".manual-tab-btn")) {
      const tabId = Number(e.target.dataset.tabId);
      switchManualTab(tabId);
    }
  });

  addManualItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeManualTabId) {
      alert("Por favor, crea y selecciona una pestaña primero.");
      return;
    }
    await addManualItemToList(manualItemInput.value, activeManualTabId);
  });

  manualListItemsContainer.addEventListener("click", async (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.closest(".delete-manual-item-btn")) {
      if (confirm("¿Estás seguro de que quieres eliminar este artículo?")) {
        try {
          await axios.delete(`/api/shopping-list/manual/${id}`);
        } catch (error) {
          console.error("Error al eliminar el artículo:", error);
          alert("No se pudo eliminar el artículo.");
        }
      }
    } else if (e.target.matches(".manual-item-checkbox")) {
      const checkbox = e.target;
      try {
        await axios.put(`/api/shopping-list/manual/${id}`, { checked: checkbox.checked });
      } catch (error) {
        console.error("Error al actualizar el artículo:", error);
        alert("No se pudo actualizar el artículo.");
      }
    }
  });

  if (toggleManualDragBtn) {
    toggleManualDragBtn.addEventListener("click", () => {
      if (!manualListSortable) return;
      const isDisabled = manualListSortable.option("disabled");
      manualListSortable.option("disabled", !isDisabled);

      manualDragLockedIcon.classList.toggle("hidden", isDisabled);
      manualDragUnlockedIcon.classList.toggle("hidden", !isDisabled);
      toggleManualDragBtn.classList.toggle("bg-green-100", isDisabled);
      toggleManualDragBtn.classList.toggle("dark:bg-green-900", isDisabled);
    });
  }

  // --- WebSocket Event Listeners ---
  socket.on("tab:created", (newTab) => {
    manualListTabs.push(newTab);
    if (!activeManualTabId) {
      activeManualTabId = newTab.id;
    }
    renderManualTabs();
    renderManualItemLists();
  });

  socket.on("tab:renamed", (updatedTab) => {
    const tab = manualListTabs.find((t) => t.id == updatedTab.id);
    if (tab) {
      tab.name = updatedTab.name;
      renderManualTabs();
    }
  });

  socket.on("tab:deleted", (deletedTab) => {
    manualListTabs = manualListTabs.filter((t) => t.id != deletedTab.id);
    if (activeManualTabId == deletedTab.id) {
      activeManualTabId = manualListTabs.length > 0 ? manualListTabs[0].id : null;
    }
    renderManualTabs();
    renderManualItemLists();
  });

  socket.on("item:added", (newItem) => {
    manualListItems.push(newItem);
    renderManualItemLists();
  });

  socket.on("item:updated", (updatedItem) => {
    const item = manualListItems.find((i) => i.id == updatedItem.id);
    if (item) {
      item.checked = updatedItem.checked;
      renderManualItemLists();
    }
  });

  socket.on("item:deleted", (deletedItem) => {
    manualListItems = manualListItems.filter((i) => i.id != deletedItem.id);
    renderManualItemLists();
  });

  socket.on("items:reordered", ({ orderedIds, tabId }) => {
    if (tabId == activeManualTabId) {
      const itemMap = new Map(manualListItems.map((item) => [item.id.toString(), item]));
      const reorderedItems = orderedIds.map((id) => itemMap.get(id));
      const otherItems = manualListItems.filter((item) => item.tabId !== tabId);
      manualListItems = [...reorderedItems, ...otherItems];
      renderManualItemLists();
    }
  });

  // --- Inicialización ---
  loadListFromStorage();
  setInitialWeek();
  updateMonthDisplay();
  switchTab("monthly");
  initManualList();
});
