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
      // Al entrar en modo cocina, nos aseguramos de que el tema oscuro se respete.
      // Los estilos CSS de 'kitchen-mode' deben usar 'dark:' para el fondo.
      if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
      }
      requestWakeLock();
    }
  };

  const removeKitchenMode = () => {
    if (body.classList.contains("kitchen-mode")) {
      body.classList.remove("kitchen-mode");
      releaseWakeLock(); // Liberamos el bloqueo de pantalla al salir.
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

  // --- Interactive Timer Functionality ---
  let timerInterval = null;
  let currentTimerDuration = 0;
  let originalTimerDuration = 0;
  let timerDisplayElement = null;
  let timerRecipeName = '';
  let timerModal = null;
  let timerSound = new Audio('/sounds/timer-beep.mp3'); // TODO: Ensure this path is correct and sound file exists

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
        h,
        m,
        s
      ]
      .map(v => v < 10 ? '0' + v : v)
      .filter((v, i) => v !== '00' || i > 0 || h > 0) // Don't show leading '00:' for hours if no hours
      .join(':');
  };

  const updateTimerDisplay = () => {
    if (timerDisplayElement) {
      timerDisplayElement.textContent = formatTime(currentTimerDuration);
    }
  };

  const startTimer = (duration, recipeName) => {
    if (timerInterval) clearInterval(timerInterval); // Clear any existing timer

    originalTimerDuration = duration;
    currentTimerDuration = duration;
    timerRecipeName = recipeName;

    if (timerModal) {
      document.getElementById('timer-modal-title').textContent = `Temporizador para: ${timerRecipeName}`;
      timerModal.classList.remove('hidden');
    }
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      currentTimerDuration--;
      updateTimerDisplay();

      if (currentTimerDuration <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (timerSound) timerSound.play();
        alert(`¡Tiempo terminado para "${timerRecipeName}"!`);
        if (timerModal) timerModal.classList.add('hidden'); // Hide modal after completion
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    currentTimerDuration = originalTimerDuration;
    updateTimerDisplay();
  };

  // Event listener for timer triggers
  document.querySelectorAll('.timer-trigger').forEach(trigger => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const duration = parseInt(trigger.dataset.duration, 10);
      // Try to find the recipe title from the nearest h1 or a global variable
      const recipeTitle = document.querySelector('.prose h1')?.textContent || document.title;
      startTimer(duration, recipeTitle);
    });
  });

  // Initialize timer modal elements
  timerModal = document.getElementById('timer-modal');
  timerDisplayElement = document.getElementById('timer-display');
  const timerStartPauseBtn = document.getElementById('timer-start-pause-btn');
  const timerResetBtn = document.getElementById('timer-reset-btn');
  const timerCloseBtn = document.getElementById('timer-close-btn');

  if (timerStartPauseBtn) {
    timerStartPauseBtn.addEventListener('click', () => {
      if (timerInterval) {
        stopTimer();
        timerStartPauseBtn.textContent = 'Iniciar';
      } else {
        startTimer(currentTimerDuration, timerRecipeName); // Resume from current duration
        timerStartPauseBtn.textContent = 'Pausar';
      }
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => {
      resetTimer();
      if (timerStartPauseBtn) timerStartPauseBtn.textContent = 'Iniciar';
    });
  }

  if (timerCloseBtn) {
    timerCloseBtn.addEventListener('click', () => {
      if (timerModal) timerModal.classList.add('hidden');
      stopTimer(); // Stop timer when modal is closed
    });
  }
});
