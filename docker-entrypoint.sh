#!/bin/sh
set -e
# Asegura que los volúmenes existan y sean escribibles por node (uid 1000).
# Corre como root al arrancar, luego baja a node con su-exec.
DATA_DIR="${DATA_DIR:-/app/data}"
RECIPES_DIR="${RECIPES_DIR:-/app/recetas}"
mkdir -p "$DATA_DIR" "$RECIPES_DIR" "$RECIPES_DIR/attachment"
chown -R node:node "$DATA_DIR" "$RECIPES_DIR" 2>/dev/null || true
exec su-exec node "$@"
