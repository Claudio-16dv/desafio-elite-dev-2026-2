#!/bin/sh
# Aplica as migrations pendentes e inicia a API.
# (A semeadura dos dados de demonstração roda dentro da API quando SEED_ON_BOOT=true.)
set -e

# Plataformas com banco gerenciado (ex.: Northflank) expõem a string de conexão como
# POSTGRES_URI. Se DATABASE_URL não foi definida, usamos essa.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_URI:-}" ]; then
  export DATABASE_URL="$POSTGRES_URI"
  echo "[entrypoint] DATABASE_URL definida a partir de POSTGRES_URI."
fi

echo "[entrypoint] Aplicando migrations do banco..."
npx prisma migrate deploy

echo "[entrypoint] Iniciando a API..."
exec "$@"
