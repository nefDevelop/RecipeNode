# Imagen de reciperNode. El servicio estaba antes como una unidad de systemd de
# usuario (reciperNode.service), lo que hacia depender de que la sesion del
# usuario siguiera viva. En contenedor lo gestiona Docker y sobrevive cierres de
# sesion igual que el resto de servicios.

FROM node:22-alpine

WORKDIR /app

# sqlite3 necesita las librerias de compilacion para el binding nativo, y bash
# para el watcher de chokidar. Se instalan antes de npm install porque el
# paquete las necesita durante la compilacion.
RUN apk add --no-cache python3 make g++ bash

# Primero solo los manifiestos, para que la capa de dependencias se reutilice
# mientras no cambien.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8214

EXPOSE 8214

# El proceso corre como root porque los ficheros de recipes y las bases de datos
# estan en volumenes montados desde el host y pertenecen al usuario del host; sin
# esto el contenedor no podria escribir en ellos.
CMD ["node", "index.js"]
