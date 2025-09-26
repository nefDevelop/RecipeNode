const CACHE_NAME = "recipe-node-cache-v1";
// Lista de archivos que componen el "App Shell".
const APP_SHELL_URLS = [
  "/",
  "/shopping-list",
  "/planning",
  "/login",
  "/register",
  "/settings",
  "/css/style.css",
  "/css/kitchen-mode.css",
  "/css/print.css",
  "/js/shopping-list.js",
  "/js/kitchen-mode.js",
  "/js/recipe-scaler.js",
  "/js/sidebar-search.js",
  "https://cdn.tailwindcss.com",
  "https://cdn.tailwindcss.com?plugins=typography",
  "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js",
  "https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js",
];

// Evento de instalación: se dispara cuando el service worker se instala por primera vez.
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Cacheando el App Shell");
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Evento de fetch: se dispara cada vez que la aplicación realiza una petición (p. ej., a un CSS, JS, imagen o API).
self.addEventListener("fetch", (event) => {
  // Estrategia: Network First (primero la red, luego la caché)
  // Es buena para contenido que puede cambiar, pero queremos que funcione offline.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la petición a la red tiene éxito, la usamos y la guardamos en caché para el futuro.
        return caches.open(CACHE_NAME).then((cache) => {
          // Solo cacheamos peticiones GET exitosas.
          if (event.request.method === "GET" && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Si la petición a la red falla (estamos sin conexión), intentamos servir desde la caché.
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si tampoco está en la caché, la petición falla (esto es normal para APIs sin conexión).
        });
      })
  );
});
