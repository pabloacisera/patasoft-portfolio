#!/bin/sh
set -e

echo "Ejecutando migraciones de base de datos..."
npx prisma db push --accept-data-loss || true

echo "Iniciando servidor..."
exec npm run start:prod