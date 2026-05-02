#!/bin/bash

# ============================================
# Script de inicio para desarrollo con ngrok
# Resuelve el problema de URL cambiante
# ============================================

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando entorno de desarrollo...${NC}"

# ---- 1. Verificar si ngrok ya está corriendo ----
NGROK_PID=$(pgrep -f "ngrok http 3000" || echo "")
if [ -n "$NGROK_PID" ]; then
  echo -e "${YELLOW}⚠️  ngrok ya está corriendo (PID: $NGROK_PID)${NC}"
else
  echo "📡 Iniciando ngrok en puerto 3000..."
  ngrok http 3000 --log=stdout > /tmp/ngrok.log &
  NGROK_PID=$!
  echo "   PID de ngrok: $NGROK_PID"
  # Esperar a que ngrok esté listo
  sleep 3
fi

# ---- 2. Obtener la URL pública de ngrok ----
echo "🔍 Obteniendo URL pública de ngrok..."
NGROK_URL=""
MAX_RETRIES=10
RETRY_COUNT=0

while [ -z "$NGROK_URL" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -oP '"public_url": "\Khttps://[^"]+' | head -1 || echo "")
  if [ -z "$NGROK_URL" ]; then
    echo "   Esperando a ngrok... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT+1))
  fi
done

if [ -z "$NGROK_URL" ]; then
  echo -e "${YELLOW}❌ No se pudo obtener la URL de ngrok. Verificá que ngrok esté corriendo.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ URL de ngrok: $NGROK_URL${NC}"

# ---- 3. Actualizar BACKEND_URL en backend/.env ----
BACKEND_ENV="/home/kscod/projects/veterinaria/backend/.env"
if [ -f "$BACKEND_ENV" ]; then
  echo "📝 Actualizando BACKEND_URL en $BACKEND_ENV..."
  # Usar sed para reemplazar la línea de BACKEND_URL
  sed -i "s|^BACKEND_URL=.*|BACKEND_URL=$NGROK_URL|" "$BACKEND_ENV"
  echo -e "${GREEN}✅ BACKEND_URL actualizado${NC}"
else
  echo -e "${YELLOW}⚠️  No se encontró $BACKEND_ENV${NC}"
fi

# ---- 4. Actualizar FRONTEND_URL en backend/.env (para redirecciones) ----
if [ -f "$BACKEND_ENV" ]; then
  # El frontend sigue en localhost:5173
  echo "📝 Configuración lista:"
  grep "^BACKEND_URL=" "$BACKEND_ENV"
  grep "^FRONTEND_URL=" "$BACKEND_ENV"
fi

# ---- 5. Mostrar instrucciones para Mercado Pago ----
echo ""
echo -e "${YELLOW}📋 IMPORTANTE - Configuración de Mercado Pago:${NC}"
echo "   Copiá esta URL y actualizá la Redirect URI en tu aplicación de MP:"
echo -e "   ${GREEN}$NGROK_URL/api/v1/mercadopago/oauth/callback${NC}"
echo ""
echo "   También actualizá en el panel de MP la URL de redirección:"
echo "   1. Andá a https://www.mercadopago.com.ar/developers/es/tus-integrations"
echo "   2. Editá tu aplicación"
echo "   3. Pegá la URL arriba en 'Redirect URL'"
echo ""

# ---- 6. Iniciar el backend ----
echo "🚀 Iniciando backend NestJS..."
cd /home/kscod/projects/veterinaria/backend
npm run start:dev

