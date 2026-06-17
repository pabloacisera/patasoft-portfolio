#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_DIR="$BASE_DIR/logs"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"
BACKEND_ENV="$BACKEND_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { log "${GREEN}✓${NC} $1"; }
warn() { log "${YELLOW}⚠${NC} $1"; }
fail() { log "${RED}✗${NC} $1"; }

PIDS=()
cleanup() {
    echo ""
    warn "Deteniendo servicios..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    ok "Todos los servicios detenidos"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

mkdir -p "$LOG_DIR"

log "========================================"
log "  PataSoft - Entorno de Desarrollo"
log "========================================"
echo ""

# ─────────────────────────────────────────
# 1. INFRAESTRUCTURA LOCAL
# ─────────────────────────────────────────
log "Verificando PostgreSQL..."
if pg_isready -q 2>/dev/null; then
    ok "PostgreSQL corriendo"
else
    fail "PostgreSQL no responde. Ejecutá: sudo service postgresql start"
    exit 1
fi

log "Verificando Redis..."
if redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis corriendo"
else
    fail "Redis no responde. Ejecutá: sudo service redis-server start"
    exit 1
fi

echo ""

# ─────────────────────────────────────────
# 2. CLOUDFLARE NAMED TUNNEL (primero)
#    El backend necesita leer GOOGLE_CALLBACK_URL
#    con la URL correcta del tunnel al arrancar.
# ─────────────────────────────────────────
log "Iniciando Cloudflare Named Tunnel..."

if ! command -v cloudflared &>/dev/null; then
    fail "cloudflared no está instalado."
    fail "Instalalo con: curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null"
    fail "O descargá el binario desde: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

# Leer token desde backend/.env
if [ ! -f "$BACKEND_ENV" ]; then
    fail "No se encontró $BACKEND_ENV"
    exit 1
fi

TUNNEL_TOKEN=$(grep -oP '^CLOUDFLARE_TUNNEL_TOKEN=\K.*' "$BACKEND_ENV" 2>/dev/null || true)

if [ -z "$TUNNEL_TOKEN" ]; then
    fail "CLOUDFLARE_TUNNEL_TOKEN no definido en $BACKEND_ENV"
    fail "Agregá la línea: CLOUDFLARE_TUNNEL_TOKEN=eyJ..."
    exit 1
fi

# El token Named Tunnel NO cambia. El dominio asociado tampoco.
# Arrancamos el tunnel y esperamos que confirme conexión.
> "$LOG_DIR/tunnel.log"
cloudflared tunnel run --token "$TUNNEL_TOKEN" > "$LOG_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
PIDS+=("$TUNNEL_PID")

log "Esperando que el tunnel establezca conexión (hasta 20s)..."
TUNNEL_CONNECTED=false
for i in $(seq 1 20); do
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
        fail "cloudflared murió al iniciar. Revisá: $LOG_DIR/tunnel.log"
        cat "$LOG_DIR/tunnel.log" | tail -20
        exit 1
    fi
    # "INF Connection" aparece cuando al menos 1 conector está activo
    if grep -q "INF Connection" "$LOG_DIR/tunnel.log" 2>/dev/null; then
        TUNNEL_CONNECTED=true
        break
    fi
    sleep 1
done

if [ "$TUNNEL_CONNECTED" = false ]; then
    warn "El tunnel tardó más de lo esperado pero el proceso sigue corriendo."
    warn "Revisá: $LOG_DIR/tunnel.log"
fi

# Leer el hostname del tunnel desde el .env (solo lectura)
TUNNEL_HOSTNAME=$(grep -oP '^CLOUDFLARE_TUNNEL_HOSTNAME=\K.*' "$BACKEND_ENV" 2>/dev/null || true)

# Calcular GOOGLE_CALLBACK_URL en memoria (NUNCA escribir en .env — REGLA INMOVIBLE ADR-016)
CALLBACK_URL=""
if [ -z "$TUNNEL_HOSTNAME" ]; then
    warn "CLOUDFLARE_TUNNEL_HOSTNAME no definido en $BACKEND_ENV"
    warn "Agregá: CLOUDFLARE_TUNNEL_HOSTNAME=https://api-patasoft.artisandevs.site"
    warn "Usando GOOGLE_CALLBACK_URL por defecto del .env (localhost)..."
else
    # Asegurar HTTPS
    TUNNEL_HOSTNAME="${TUNNEL_HOSTNAME#http://}"
    TUNNEL_HOSTNAME="https://${TUNNEL_HOSTNAME#https://}"

    CALLBACK_URL="${TUNNEL_HOSTNAME}/api/v1/auth/google/callback"

    ok "Cloudflare Tunnel activo (PID: $TUNNEL_PID)"
    ok "Tunnel hostname: $TUNNEL_HOSTNAME"
    ok "GOOGLE_CALLBACK_URL calculado → $CALLBACK_URL"
fi

echo ""

# ─────────────────────────────────────────
# 3. BACKEND (después del tunnel)
#    Pasar GOOGLE_CALLBACK_URL como variable de entorno del proceso
#    REGLA INMOVIBLE: NUNCA modificar .env (ADR-016)
# ─────────────────────────────────────────
log "Iniciando Backend (NestJS) en puerto 3000..."
cd "$BACKEND_DIR"

# Exportar GOOGLE_CALLBACK_URL si se calculó (override del .env en memoria)
if [ -n "$CALLBACK_URL" ]; then
    export GOOGLE_CALLBACK_URL="$CALLBACK_URL"
    log "GOOGLE_CALLBACK_URL inyectado en entorno del proceso: $CALLBACK_URL"
fi

log "Generando Prisma client..."
npx prisma generate > "$LOG_DIR/prisma.log" 2>&1 || true

npm run start:dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

log "Esperando que el backend levante (hasta 60s)..."
BACKEND_READY=false
for i in $(seq 1 30); do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        fail "Backend murió al iniciar. Revisá: $LOG_DIR/backend.log"
        tail -30 "$LOG_DIR/backend.log"
        exit 1
    fi
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    sleep 2
done

if [ "$BACKEND_READY" = true ]; then
    ok "Backend listo (PID: $BACKEND_PID) — health check OK"
else
    warn "Backend no respondió el health check aún, pero el proceso sigue corriendo"
    warn "Revisá: $LOG_DIR/backend.log"
fi

echo ""

# ─────────────────────────────────────────
# 4. FRONTEND (Vite)
# ─────────────────────────────────────────
log "Iniciando Frontend (Vite) en puerto 5173..."
cd "$FRONTEND_DIR"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")
sleep 3

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    ok "Frontend iniciado (PID: $FRONTEND_PID)"
else
    fail "Frontend falló al iniciar. Revisá: $LOG_DIR/frontend.log"
    exit 1
fi

echo ""
log "========================================"
log "  ✓ Todos los servicios corriendo"
log "========================================"
echo ""
log "  Frontend:  ${CYAN}http://localhost:5173${NC}"
log "  Backend:   ${CYAN}http://localhost:3000${NC}"
log "  Health:    ${CYAN}http://localhost:3000/health${NC}"
if [ -n "$TUNNEL_HOSTNAME" ]; then
    log "  Tunnel:    ${CYAN}${TUNNEL_HOSTNAME}${NC}"
    log "  Callback:  ${CYAN}${TUNNEL_HOSTNAME}/api/v1/auth/google/callback${NC}"
fi
echo ""
log "  Logs en tiempo real:"
log "    Backend:  ${YELLOW}tail -f $LOG_DIR/backend.log${NC}"
log "    Frontend: ${YELLOW}tail -f $LOG_DIR/frontend.log${NC}"
log "    Tunnel:   ${YELLOW}tail -f $LOG_DIR/tunnel.log${NC}"
echo ""
log "  Para detener: ${RED}Ctrl+C${NC}"
log "========================================"
echo ""

wait
