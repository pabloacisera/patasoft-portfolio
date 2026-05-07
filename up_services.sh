#!/bin/bash

# ============================================
# PataSoft — Orchestrator Local (Sin Docker)
# ============================================

# Configuración de Rutas
BASE_DIR="/home/kscod/projects/veterinaria"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"
AI_DIR="$BASE_DIR/ai-service"

# Configuración Cloudflare
# IMPORTANTE: Reemplaza este token si creas un túnel nuevo para corregir el SSL
CF_TOKEN="eyJhIjoiN2QwOGRlNzQyNzFiNmViMDA4YmNkNzk1Njg2ZDI2YWQiLCJ0IjoiOGYzNmE1MjItMDYyOS00MmE3LThkMmItN2Q1ODY3Y2JjYTdhIiwicyI6Ik5ERXpZVEV3TnpndE1ERTNNUzAwT0RRMkxXSXpOamt0TVRSbVpUUmhOMkk1TTJJeCJ9"

# Colores para la terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Función para verificar servicios del sistema (Postgres y Redis)
check_system_services() {
    echo -e "${CYAN}🐘 Verificando PostgreSQL...${NC}"
    if ! systemctl is-active --quiet postgresql; then
        sudo systemctl start postgresql
        echo -e "${GREEN}✓ PostgreSQL iniciado.${NC}"
    else
        echo -e "${GREEN}✓ PostgreSQL ya está corriendo.${NC}"
    fi

    echo -e "${CYAN}🔴 Verificando Redis...${NC}"
    if ! systemctl is-active --quiet redis-server; then
        sudo systemctl start redis-server
        echo -e "${GREEN}✓ Redis iniciado.${NC}"
    else
        echo -e "${GREEN}✓ Redis ya está corriendo.${NC}"
    fi
}

# Funciones de control individual
start_ai() {
    echo -e "${CYAN}🤖 Iniciando AI Service (8000)...${NC}"
    cd "$AI_DIR"
    nohup python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/ai-service.log 2>&1 &
}

start_backend() {
    echo -e "${CYAN}⚙️  Iniciando Backend (3000)...${NC}"
    cd "$BACKEND_DIR"
    nohup npm run start:dev > /tmp/backend.log 2>&1 &
}

start_frontend() {
    echo -e "${CYAN}🌐 Iniciando Frontend (5173)...${NC}"
    cd "$FRONTEND_DIR"
    nohup npm run dev:local > /tmp/frontend.log 2>&1 &
}

start_tunnel() {
    echo -e "${CYAN}☁️  Iniciando Cloudflare Tunnel...${NC}"
    # Se usa nohup para que el túnel persista en segundo plano
    nohup cloudflared tunnel run --token $CF_TOKEN > /tmp/tunnel.log 2>&1 &
}

stop_service() {
    case $1 in
        ai) pkill -9 -f "uvicorn app.main:app" ;;
        backend) pkill -9 -f "nest start" || pkill -9 -f "ts-node" ;;
        frontend) pkill -9 -f "vite" ;;
        tunnel) sudo pkill -9 cloudflared ;;
        all) 
            pkill -9 -f "uvicorn app.main:app"
            pkill -9 -f "nest start" || pkill -9 -f "ts-node"
            pkill -9 -f "vite"
            sudo pkill -9 cloudflared 
            ;;
    esac
}

# Menú de comandos
case "$1" in
    start)
        echo -e "${GREEN}🚀 Iniciando PataSoft en modo local...${NC}"
        check_system_services
        stop_service all
        sleep 2
        start_ai
        start_backend
        start_frontend
        start_tunnel
        echo -e "${GREEN}✅ Todos los servicios están en marcha.${NC}"
        ;;
    stop)
        echo -e "${RED}🛑 Deteniendo todos los servicios...${NC}"
        stop_service all
        ;;
    restart)
        shift 
        if [ -z "$1" ]; then
            $0 stop && $0 start
        else
            echo -e "${YELLOW}♻️  Reiniciando servicio: $1...${NC}"
            stop_service $1
            sleep 1
            case $1 in
                ai) start_ai ;;
                backend) start_backend ;;
                frontend) start_frontend ;;
                tunnel) start_tunnel ;;
            esac
        fi
        ;;
    status)
        echo -e "${CYAN}--- Estado de los Servicios ---${NC}"
        pgrep -f "uvicorn" > /dev/null && echo -e "AI Service:  ${GREEN}ACTIVO${NC}" || echo -e "AI Service:  ${RED}DOWN${NC}"
        pgrep -f "nest|ts-node" > /dev/null && echo -e "Backend:     ${GREEN}ACTIVO${NC}" || echo -e "Backend:     ${RED}DOWN${NC}"
        pgrep -f "vite" > /dev/null && echo -e "Frontend:    ${GREEN}ACTIVO${NC}" || echo -e "Frontend:    ${RED}DOWN${NC}"
        pgrep "cloudflared" > /dev/null && echo -e "Cloudflare:  ${GREEN}ACTIVO${NC}" || echo -e "Cloudflare:  ${RED}DOWN${NC}"
        ;;
    logs)
        tail -f /tmp/backend.log /tmp/ai-service.log /tmp/frontend.log /tmp/tunnel.log
        ;;
    *)
        echo -e "${YELLOW}Uso: $0 {start|stop|status|logs|restart [ai|backend|frontend|tunnel]}${NC}"
        exit 1
esac