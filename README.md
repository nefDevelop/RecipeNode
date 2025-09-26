# RecipeNode: Aplicación de Recetas

> Una aplicación web construida con Node.js, Express y SQLite para gestionar y compartir recetas de cocina.

Este proyecto es una aplicación web completa que permite a los usuarios crear, visualizar, actualizar y eliminar recetas. Utiliza un backend robusto con Express.js para la gestión de rutas y la lógica de negocio, y SQLite como base de datos ligera y basada en archivos.

## ✨ Características

- Característica 1
- Característica 2
- Característica 3

## 🚀 Empezando

Estas instrucciones te permitirán obtener una copia del proyecto en funcionamiento en tu máquina local para propósitos de desarrollo y pruebas.

### 📋 Prerrequisitos

¿Qué cosas necesitas para instalar el software y cómo instalarlas?

- [Node.js](https://nodejs.org/) (v18.x o superior recomendado)
- [npm](https://www.npmjs.com/) (normalmente viene con Node.js)
- El proyecto utiliza **SQLite**, que se gestiona a través de la dependencia `sqlite3` de npm y no requiere la instalación de un servidor de base de datos por separado.

### 🔧 Instalación

Sigue estos pasos para tener un entorno de desarrollo listo:

1. Clona el repositorio:
   ```sh
   git clone https://github.com/tu-usuario/tu-repositorio.git
   ```
2. Navega al directorio del proyecto:
   ```sh
   cd tu-repositorio
   ```
3. Instala las dependencias:
   ```sh
   npm install
   ```

## 🏃 Uso

Para iniciar la aplicación en modo de desarrollo:

```sh
npm run dev
```

Para ejecutar la aplicación en producción:

```sh
npm start
```

## 📝 Estructura de Recetas Markdown

Las recetas se almacenan como archivos Markdown (`.md`) en el directorio `recetas/`. Cada archivo debe comenzar con un bloque de "front-matter" YAML, seguido del contenido de la receta en Markdown.

### Front-Matter (YAML)

El bloque de front-matter contiene metadatos clave sobre la receta. Debe estar delimitado por `---` al principio y al final.

Ejemplo:

```yaml
---
title: "Mi Receta Deliciosa"
image: "/resources/mi-receta-deliciosa.jpg" # Opcional: ruta a la imagen principal
servings: 4 # Opcional: número de porciones
time: 60 # Opcional: tiempo de cocción en minutos
cuisine: "Mediterránea" # Opcional: tipo de cocina
source: "https://ejemplo.com/receta-original" # Opcional: URL de la receta original
created: 2023-10-26T10:00:00Z # Opcional: fecha de creación (ISO 8601)
updated: 2023-10-26T10:00:00Z # Opcional: fecha de última actualización (ISO 8601)
---
```

**Campos requeridos y opcionales:**

*   `title` (string, **requerido**): El nombre de la receta.
*   `image` (string, opcional): La ruta a la imagen principal de la receta. Puede ser una URL relativa (`/resources/imagen.jpg`) o absoluta.
*   `servings` (número, opcional): El número de porciones que rinde la receta. Utilizado para escalar ingredientes.
*   `time` (número, opcional): El tiempo total de cocción en minutos. Utilizado para filtrar.
*   `cuisine` (string, opcional): El tipo de cocina (ej. "Italiana", "Mexicana"). Utilizado para filtrar.
*   `source` (string, opcional): La URL de la receta original si fue importada o adaptada.
*   `created` (string, opcional): Fecha y hora de creación de la receta en formato ISO 8601.
*   `updated` (string, opcional): Fecha y hora de la última actualización de la receta en formato ISO 8601.

### Contenido Markdown

Después del front-matter, el resto del archivo es el contenido de la receta en formato Markdown. Se recomienda estructurar el contenido con encabezados para secciones como "Ingredientes", "Instrucciones", "Notas", etc.

**Sintaxis especial:**

*   **Imágenes de Obsidian:** `![[nombre-de-imagen.jpg]]` se convierte automáticamente en una etiqueta `<img>`.
*   **Enlaces a otras recetas:** `[[Nombre de Otra Receta]]` se convierte en un enlace a esa receta dentro de la aplicación.
*   **Listas de tareas:** Las listas de tareas Markdown (`- [ ] Tarea`) se renderizan como casillas de verificación interactivas.
*   **Temporizadores:** Patrones como "10 minutos" o "30 segundos" se pueden convertir en temporizadores interactivos.

```markdown
# Mi Receta Deliciosa

## Ingredientes

- 2 pechugas de pollo
- 1 cebolla
- 10 minutos de cocción

## Instrucciones

1.  Paso uno.
2.  Paso dos.
```

## 🧪 Ejecutando las Pruebas

Para ejecutar el conjunto de pruebas automatizadas:

```sh
npm test
```

## 🤝 Contribuyendo

Las contribuciones son lo que hacen que la comunidad de código abierto sea un lugar increíble para aprender, inspirar y crear. Cualquier contribución que hagas será **muy apreciada**.

Por favor, lee `CONTRIBUTING.md` (si existe) para más detalles sobre nuestro código de conducta y el proceso para enviarnos pull requests.

## 📄 Licencia

Este proyecto está bajo la Licencia (Tu Licencia) - mira el archivo `LICENSE.md` para más detalles.
