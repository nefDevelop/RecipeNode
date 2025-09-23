document.addEventListener("DOMContentLoaded", () => {
  const enterBtn = document.getElementById("enter-kitchen-mode-btn");
  const exitBtn = document.getElementById("exit-kitchen-mode-btn");
  const body = document.body;

  // La API Screen Wake Lock puede no estar disponible en todos los navegadores.
  if (!("wakeLock" in navigator)) {
    console.log("Screen Wake Lock API no soportada.");
    if (enterBtn) enterBtn.style.display = "none"; // Oculta el botón si no es soportada
    return;
  }

  let wakeLock = null;

  const requestWakeLock = async () => {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("Screen Wake Lock está activo.");
      wakeLock.addEventListener("release", () => console.log("Screen Wake Lock fue liberado."));
    } catch (err) {
      console.error(`No se pudo adquirir el wake lock: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLock) {
      wakeLock.release().then(() => {
        wakeLock = null;
      });
    }
  };

  const applyKitchenMode = () => {
    if (!body.classList.contains("kitchen-mode")) {
      body.classList.add("kitchen-mode");
      requestWakeLock();
    }
  };

  const removeKitchenMode = () => {
    if (body.classList.contains("kitchen-mode")) {
      body.classList.remove("kitchen-mode");
      releaseWakeLock();
    }
  };

  // --- Event Listeners ---

  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      location.hash = "kitchen";
    });
  }

  if (exitBtn) {
    exitBtn.addEventListener("click", () => history.back());
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && body.classList.contains("kitchen-mode")) {
      history.back();
    }
  });

  window.addEventListener("hashchange", () => {
    if (location.hash === "#kitchen") {
      applyKitchenMode();
    } else {
      removeKitchenMode();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (body.classList.contains("kitchen-mode") && document.visibilityState === "visible") {
      await requestWakeLock();
    }
  });

  // Comprobación inicial al cargar la página
  if (location.hash === "#kitchen") {
    applyKitchenMode();
  }
});
