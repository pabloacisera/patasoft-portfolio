#!/bin/sh
set -e

echo "Ejecutando migraciones de base de datos..."
npx prisma migrate deploy

echo "Iniciando servidor..."
exec npm run start:prod
