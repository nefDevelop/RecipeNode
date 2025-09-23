# Roadmap del Proyecto: RecipeNode

## Fase 1: Configuración y Estructura Base

- [x] Tarea 1: Configuración del entorno

  - [x] Definir stack tecnológico:
    - Backend: Node.js, Express.js
    - Base de datos: SQLite
    - Frontend: HTML, CSS con Tailwind CSS
    - Librerías: `express`, `sqlite3`, `gray-matter`, `markdown-it`, `axios`, `cheerio`, `bcrypt`
  - [x] Crear estructura de carpetas del proyecto (`server`, `public`, `recetas`).
  - [x] Inicializar proyecto Node.js (`npm init -y`).
  - [x] Instalar dependencias (`npm install ...`).
  - [x] Crear carpeta `public/resources` para imágenes.

- [x] **Tarea 2: Base de Datos**
  - [x] Crear script de inicialización (`init-db.js`).
  - [x] Definir y crear tabla `users` (id, username, password, role).
  - [x] Definir y crear tabla `recipes` (id, title, servings, author_id).
  - [x] Definir y crear tabla `planning` (date, meal_type, recipe_name).
  - [x] Insertar un usuario administrador inicial en el script.
  - [x] Crear script para poblar la tabla `recipes` desde los archivos `.md` existentes.

## Fase 2: API Core y Funcionalidades Principales

- [x] **Tarea 3: API de Recetas y Planificación**
  - [x] **Rutas de Recetas:**
    - [x] `GET /api/recipes`: Obtener lista de todas las recetas.
    - [x] `GET /api/recipes/:id`: Obtener una receta individual.
      - [x] Implementar conversión de enlaces `![[imagen.png]]` a `<img>`.
    - [x] `POST /api/recipes`: Crear nueva receta desde la web (genera archivo `.md`).
    - [x] `POST /api/recipes/scrape`: Importar receta desde una URL.
  - [x] **Rutas de Planificación:**
    - [x] `GET /api/planning`: Obtener todas las recetas planificadas.
    - [x] `POST /api/planning`: Asignar una receta a una fecha y tipo de comida.
  - [x] **Ruta de Lista de la Compra:**
    - [x] `GET /api/shopping-list`: Generar lista de la compra para un rango de fechas.
      - [x] Crear módulo para analizar, estandarizar y sumar ingredientes.
      - [x] Manejar convenciones de unidades (ej. `100 g`).

## Fase 3: Usuarios y Frontend

- [x] **Tarea 4: Sistema de Autenticación**

  - [x] Definir roles de usuario (Público, Usuario, Admin).
  - [x] Implementar rutas `POST /register` y `POST /login`.
  - [x] Proteger rutas de la API (POST, PUT, DELETE) con middleware de autenticación.
  - [x] Implementar middleware de autorización basado en roles (user vs admin).

- [x] **Tarea 5: Interfaz de Usuario (Frontend)**
  - [x] **Estructura y Estilo:**
    - [x] Construir la interfaz base con HTML y Tailwind CSS.
    - [x] Asegurar diseño responsivo para móviles.
  - [x] **Componentes y Vistas:**
    - [x] Vista de catálogo de recetas.
    - [x] Vista de detalle de receta (usar `markdown-it` para renderizar).
    - [x] Vista de planificación con calendario visual.
      - [x] Adaptar a móvil con "Tocar para Asignar".
      - [x] Implementar toggle para vista semanal/mensual.
    - [x] Vista de lista de la compra.
    - [x] Vistas y formularios de autenticación (Login/Registro).
    - [x] Formulario para crear/importar recetas.

## Fase 4: Funcionalidades Adicionales y Pulido

- [ ] **Tarea 6: Mejoras de Experiencia de Usuario (UX)**
  - [x] Implementar función de búsqueda (título e ingredientes).
  - [x] Implementar "Modo Cocina" (mantener pantalla activa, se agranda la receta quitando navbar y sidebar, boton de salir del modo cocina, o pulsando atras en el movil o escape en el pc).
  - [x] Añadir funciones para compartir e imprimir recetas.
  - [x] Implementar vista de lista de la compra (semanal/mensual).
  - [ ] Implementar planificación detallada de comidas.
- [ ] Eliminar el boton hoy del calendario
- 