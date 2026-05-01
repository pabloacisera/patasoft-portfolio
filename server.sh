#!/bin/bash
set -e

# ============================================
# PataSoft - Servidor de desarrollo
# ============================================
BASE_DIR="/home/kscod/projects/veterinaria"

echo "🚀 Iniciando servicios de PataSoft..."

# --- 1. PostgreSQL y Redis (Docker) ---
echo ""
echo "📦 Verificando contenedores Docker (PostgreSQL y Redis)..."

if ! docker ps | grep -q "patasoft-postgres"; then
  echo "  → Iniciando patasoft-postgres..."
  docker start patasoft-postgres 2>/dev/null || {
    echo "  ❌ El contenedor patasoft-postgres no existe. Usando docker-compose..."
    cd "$BASE_DIR"
    docker-compose up -d postgres redis 2>/dev/null || echo "  ⚠️  No se pudo iniciar con docker-compose"
  }
else
  echo "  ✓ patasoft-postgres ya está corriendo"
fi

if ! docker ps | grep -q "patasoft-redis"; then
  echo "  → Iniciando patasoft-redis..."
  docker start patasoft-redis 2>/dev/null || echo "  ⚠️  No se pudo iniciar patasoft-redis"
else
  echo "  ✓ patasoft-redis ya está corriendo"
fi

# Esperar a que PostgreSQL esté listo
echo "  → Esperando a que PostgreSQL esté disponible..."
sleep 5

# --- 2. AI Service (FastAPI + Uvicorn) ---
echo ""
echo "🤖 Iniciando AI Service (puerto 8000)..."

# Instalar dependencias si no están
if ! python3 -c "import fastapi, uvicorn" 2>/dev/null; then
  echo "  → Instalando dependencias de Python..."
  pip3 install --break-system-packages -r "$BASE_DIR/ai-service/requirements.txt" 2>&1 | tail -3
fi

cd "$BASE_DIR/ai-service"
if pgrep -f "uvicorn app.main:app" > /dev/null; then
  echo "  ⚠️  AI Service ya está corriendo. Reiniciando..."
  pkill -f "uvicorn app.main:app" 2>/dev/null || true
  sleep 2
fi

nohup python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/ai-service.log 2>&1 &
AI_PID=$!
echo "  ✓ AI Service iniciado (PID: $AI_PID)"
echo "    Log: /tmp/ai-service.log"

# --- 3. Backend (NestJS con ts-node) ---
echo ""
echo "⚙️  Iniciando Backend (puerto 3000)..."

cd "$BASE_DIR/backend"
if pgrep -f "ts-node src/main.ts" > /dev/null || pgrep -f "nest start" > /dev/null; then
  echo "  ⚠️  Backend ya está corriendo. Reiniciando..."
  pkill -f "ts-node src/main.ts" 2>/dev/null || true
  pkill -f "nest start" 2>/dev/null || true
  sleep 2
fi

nohup npx ts-node src/main.ts > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✓ Backend iniciado (PID: $BACKEND_PID)"
echo "    Log: /tmp/backend.log"

# --- 4. Frontend (Vite) ---
echo ""
echo "🌐 Iniciando Frontend (puerto 5173)..."

cd "$BASE_DIR/frontend"
if pgrep -f "vite.*5173" > /dev/null; then
  echo "  ⚠️  Frontend ya está corriendo. Reiniciando..."
  pkill -f "vite.*5173" 2>/dev/null || true
  sleep 2
fi

nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✓ Frontend iniciado (PID: $FRONTEND_PID)"
echo "    Log: /tmp/frontend.log"

# --- Resumen ---
echo ""
echo "=========================================="
echo "✅ Todos los servicios han sido iniciados"
echo "=========================================="
echo ""
echo "📋 PIDs:"
echo "   AI Service:  $AI_PID"
echo "   Backend:     $BACKEND_PID"
echo "   Frontend:    $FRONTEND_PID"
echo ""
echo "📋 Logs:"
echo "   AI Service: tail -f /tmp/ai-service.log"
echo "   Backend:     tail -f /tmp/backend.log"
echo "   Frontend:    tail -f /tmp/frontend.log"
echo ""
echo "🌐 URLs:"
echo "   Frontend:    http://localhost:5173"
echo "   Backend:     http://localhost:3000"
echo "   AI Service:  http://localhost:8000"
echo "   PostgreSQL:   localhost:5432"
echo "   Redis:       localhost:6379"
echo ""
echo "=========================================="
