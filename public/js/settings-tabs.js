document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const createTabForm = document.getElementById("create-tab-form");
  const newTabNameInput = document.getElementById("new-tab-name");
  const tabsListContainer = document.getElementById("tabs-list");

  // Función para renderizar las pestañas en la lista
  const renderTabs = (tabs) => {
    tabsListContainer.innerHTML = ""; // Limpiar la lista actual
    if (tabs.length === 0) {
      tabsListContainer.innerHTML = `<p class="text-gray-500 dark:text-gray-400">No hay pestañas creadas.</p>`;
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "space-y-2";

    tabs.forEach((tab) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md";
      li.innerHTML = `
        <span class="font-medium">${escapeHTML(tab.name)}</span>
        <div class="flex gap-2">
          <button class="rename-btn px-3 py-1 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600" data-id="${tab.id}" data-name="${escapeHTML(tab.name)}">Renombrar</button>
          <button class="delete-btn px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600" data-id="${tab.id}" data-name="${escapeHTML(tab.name)}">Eliminar</button>
        </div>
      `;
      ul.appendChild(li);
    });

    tabsListContainer.appendChild(ul);
  };

  // Función para obtener y renderizar las pestañas
  const fetchAndRenderTabs = async () => {
    try {
      const response = await fetch("/api/tabs");
      if (!response.ok) throw new Error("Error al obtener las pestañas.");
      const tabs = await response.json();
      renderTabs(tabs);
    } catch (error) {
      console.error(error);
      tabsListContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
    }
  };

  // Manejar la creación de una nueva pestaña
  createTabForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = newTabNameInput.value.trim();
    if (!newName) return;

    try {
      const response = await fetch("/api/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "No se pudo crear la pestaña.");
      }

      newTabNameInput.value = ""; // Limpiar input
      // La UI se actualizará a través del evento de socket
    } catch (error) {
      alert(error.message);
    }
  });

  // Manejar clics en los botones de renombrar y eliminar (delegación de eventos)
  tabsListContainer.addEventListener("click", async (e) => {
    const target = e.target;

    // --- Botón de Renombrar ---
    if (target.classList.contains("rename-btn")) {
      const tabId = target.dataset.id;
      const currentName = target.dataset.name;
      const newName = prompt(`Introduce el nuevo nombre para la pestaña "${currentName}":`, currentName);

      if (newName && newName.trim() !== "" && newName.trim() !== currentName) {
        try {
          const response = await fetch(`/api/tabs/${tabId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName.trim() }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "No se pudo renombrar la pestaña.");
          }
          // La UI se actualizará a través del evento de socket
        } catch (error) {
          alert(error.message);
        }
      }
    }

    // --- Botón de Eliminar ---
    if (target.classList.contains("delete-btn")) {
      const tabId = target.dataset.id;
      const tabName = target.dataset.name;

      try {
        // 1. Obtener los artículos asociados para mostrarlos en la confirmación
        const itemsResponse = await fetch(`/api/tabs/${tabId}/items`);
        if (!itemsResponse.ok) throw new Error("No se pudieron obtener los artículos de la pestaña.");
        const items = await itemsResponse.json();

        let confirmationMessage = `¿Estás seguro de que quieres eliminar la pestaña "${tabName}"?`;
        if (items.length > 0) {
          const itemNames = items.map(item => `- ${item.text}`).join("\n");
          confirmationMessage += `\n\nSe eliminarán permanentemente los siguientes ${items.length} artículos:\n${itemNames}`;
        } else {
          confirmationMessage += `\nNo hay artículos en esta pestaña.`;
        }

        // 2. Pedir confirmación
        if (confirm(confirmationMessage)) {
          // 3. Si se confirma, eliminar la pestaña
          const deleteResponse = await fetch(`/api/tabs/${tabId}`, { method: "DELETE" });
          if (!deleteResponse.ok) {
             const errData = await deleteResponse.json();
             throw new Error(errData.error || "No se pudo eliminar la pestaña.");
          }
          // La UI se actualizará a través del evento de socket
        }
      } catch (error) {
        alert(error.message);
      }
    }
  });

  // Función para escapar HTML y prevenir XSS
  const escapeHTML = (str) => {
      const p = document.createElement("p");
      p.appendChild(document.createTextNode(str));
      return p.innerHTML;
  };

  // --- WebSocket Event Listeners ---
  socket.on("tab:created", (newTab) => {
    console.log("Socket event: tab:created", newTab);
    fetchAndRenderTabs();
  });

  socket.on("tab:renamed", (updatedTab) => {
    console.log("Socket event: tab:renamed", updatedTab);
    fetchAndRenderTabs();
  });

  socket.on("tab:deleted", (deletedTab) => {
    console.log("Socket event: tab:deleted", deletedTab);
    fetchAndRenderTabs();
  });

  // Carga inicial de las pestañas
  fetchAndRenderTabs();
});
