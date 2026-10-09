# Imagen de reciperNode. Antes corría como unidad systemd de usuario;
# en contenedor lo gestiona Docker y sobrevive cierres de sesión.

FROM node:22-alpine

WORKDIR /app

# sqlite3 necesita tooling para el binding nativo; su-exec para bajar de root a node.
RUN apk add --no-cache python3 make g++ bash su-exec

# Primero solo los manifiestos, para reutilizar la capa de dependencias.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV PORT=8214
ENV DATA_DIR=/app/data
ENV RECIPES_DIR=/app/recetas

EXPOSE 8214

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "index.js"]
