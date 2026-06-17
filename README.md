# PataSoft — SaaS de Gestión Veterinaria

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs)](https://nestjs.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)](https://postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://prisma.io/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)
[![LangChain](https://img.shields.io/badge/LangChain-Agent-1C3D5A)](https://langchain.com/)

> Aplicación web SaaS para administración de clínicas veterinarias. Gestión de mascotas, clientes, historial médico, pagos, insumos, suscripciones y documentación. Incluye asistente IA especializado con acceso a datos de la empresa (RAG dual).

---

## Stack Técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Frontend** | Vite + Vanilla JS (SPA, sin frameworks) | 5.x |
| **Backend** | NestJS + TypeScript strict mode | 10.x |
| **ORM** | Prisma | 5.22 |
| **Base de datos** | PostgreSQL 15 + pgvector | 15+ |
| **Cache / Sesiones** | Redis | 7+ |
| **AI Service (PRO)** | FastAPI + Python + LangChain | 0.115 / 3.11 |
| **LLM** | Groq (Llama 3.3 70B) / Gemini / GPT-4o | — |
| **Embeddings** | Google Gemini (text-embedding-004, 768d) | — |
| **Pagos** | MercadoPago (Checkout Pro, QR, Suscripciones) | SDK 2.12 |
| **Email** | Mailjet (transaccional) | SDK 6.x |
| **File Storage** | Cloudinary (imágenes, PDFs, documentos) | SDK 2.9 |
| **Auth** | JWT (access + refresh tokens) + Google OAuth 2.0 | — |
| **WebSockets** | Socket.IO | 4.8 |
| **PDF** | Puppeteer + Handlebars (browser pool, 2 instancias) | 22.x |
| **Testing** | Vitest (249 backend + 31 frontend) + Playwright E2E + pytest | — |
| **Proxy / HTTPS** | Cloudflare Tunnel (acceso público al backend local) | — |

---

## Arquitectura Actual

El proyecto opera en un modelo **híbrido**:

```
Usuario → HTTPS → Cloudflare Tunnel ←──→ Backend (localhost:3000)
                                                    ↑
                    Frontend (localhost:5173) ────────┘
                    PostgreSQL (localhost:5432)
                    Redis (localhost:6379)
                    AI Service (localhost:8000) [opcional]
```

- **Backend**: Corre LOCALMENTE en `localhost:3000`
- **Cloudflare Tunnel**: Expone el backend como `https://api-patasoft.artisandevs.site` (necesario para Google OAuth y webhooks de MercadoPago, que requieren HTTPS)
- **Frontend**: Vite dev server en `localhost:5173`, proxy inverso al backend
- **AI Service**: FastAPI opcional en `localhost:8000` (solo si usás modo PRO)

El script `scripts/server.sh` automatiza: Cloudflare Tunnel → Backend → Frontend.

---

## Features

### Gestión Clínica
- Mascotas: CRUD completo, fotos (Cloudinary), ficha PDF, historial médico
- Clientes: dueños con CUIL/DNI, empresa, búsqueda con filtro en vivo
- Historial médico: entrada transaccional con procedimientos, prescripciones, insumos y cobro en un solo paso
- Stock: control de insumos, alertas de stock mínimo, importación/exportación Excel
- Escala de precios: procedimientos configurables, plantilla Excel

### Pagos y Finanzas
- MercadoPago Checkout Pro (links de pago), MercadoPago QR — **producción real activa**
- Deudas / cuenta corriente con alertas programadas (cron diario)
- Comprobantes PDF generados con Puppeteer (pool de 2 browsers)
- Caja diaria (cash register)
- Suscripciones vía MercadoPago + trial de 30 días

### Conexiones entre Veterinarias
- Solicitud de conexión con consentimiento mutuo
- Compartir historial médico entre clínicas
- Notificaciones en tiempo real (WebSocket)

### Asistente IA (RAG)
- Dual mode: RAG local (NestJS + pgvector + Groq/Gemini) y PRO (FastAPI + LangChain Agent)
- LangChain Agent con 6 tools que consultan PostgreSQL directamente
- Streaming SSE real
- Memoria por sesión (ConversationBufferWindowMemory, k=10)
- Transcripción de audio (Whisper via Groq)
- Documentos RAG: indexación en pgvector + ChromaDB

### UX / Frontend
- SPA con History API router propio
- VirtualScroll con IntersectionObserver (listas >50 items)
- Code splitting dinámico por sección (`import()`)
- StepForm de 4 pasos para consultas médicas
- Modal system con focus trapping, confirm dialog, notificaciones toast
- AbortController en todas las búsquedas (evita race conditions)
- Modo invitado con sesiones Redis (72hs TTL) + migración a cuenta registrada
- Diseño responsive, prefers-reduced-motion, skip-to-content

---

## Estado del Proyecto

| Aspecto | Estado |
|---------|--------|
| **Código funcional** | 73/73 tareas del MVP completadas (scoring 8.4/10) |
| **Tests backend** | 249 tests (Vitest) |
| **Tests frontend** | 31 tests (Vitest) + Playwright E2E configurado |
| **Tests AI Service** | pytest + httpx |
| **Documentación** | 16 ADRs, FIX log (10 bugs), SPECS, TECHNICAL_GUIDE |
| **Producción** | Backend activo via Cloudflare Tunnel en `https://api-patasoft.artisandevs.site` con MercadoPago real |
| **Deploy futuro** | render.yaml configurado para Render.com (pendiente: crear Supabase + Upstash) |
| **Docker** | Dockerfiles individuales + `docker-compose.yml` para infraestructura local |

---

## Cómo Ejecutar Localmente

### Requisitos

- Node.js 18+, Python 3.10+, PostgreSQL 15+ (con pgvector), Redis 7+
- `cloudflared` (solo para funcionalidad completa con Google OAuth / MP webhooks)
- Opcional: Docker + Docker Compose

### Opción A: Inicio rápido con server.sh (recomendado)

```bash
# 1. Configurar variables de entorno
cp .env.example backend/.env
cp .env.example backend/.env.local
cp .env.example frontend/.env
# Editar backend/.env con tus credenciales reales

# 2. Instalar dependencias
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Preparar base de datos
cd backend
npx prisma generate
npx prisma migrate dev
cd ..

# 4. Iniciar todo (Cloudflare Tunnel + Backend + Frontend)
./scripts/server.sh
```

### Opción B: Sin Cloudflare Tunnel (solo CRUD, sin Google OAuth / MP webhooks)

```bash
# Terminal 1 — Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Terminal 3 — AI Service (opcional)
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Opción C: Docker (infraestructura + servicios, sin tunnel)

```bash
docker-compose up -d
# PostgreSQL: localhost:5432
# Redis: localhost:6379
# Backend: localhost:3000
# Frontend: localhost:5173
# AI Service: localhost:8000
```

> **Nota**: Docker-compose provee PostgreSQL + Redis + servicios buildados, pero NO incluye Cloudflare Tunnel. Para Google OAuth y MP webhooks funcionales, usá server.sh (Opción A).

### ¿Qué funciona sin Cloudflare Tunnel?

| Funcionalidad | Sin tunnel | Con tunnel |
|---|---|---|
| CRUD Clientes, Mascotas, Insumos | ✅ | ✅ |
| Historial Médico, Stock | ✅ | ✅ |
| Chat IA Local (Groq + pgvector) | ✅ | ✅ |
| Login con email/contraseña | ✅ | ✅ |
| Google OAuth | ❌ | ✅ |
| Webhooks MercadoPago | ❌ | ✅ |
| Pagos con MercadoPago QR/Checkout | ❌ (solo sandbox) | ✅ (producción real) |

### Verificación

```bash
curl http://localhost:3000/health
# {"status":"ok","services":{"postgresql":"ok","redis":"ok"}}
```

---

## Testing

```bash
cd backend && npm test           # 249 tests
cd frontend && npm test          # 31 tests
cd ai-service && pytest          # AI Service tests
cd frontend && npx playwright test  # E2E (requiere servidores corriendo)
```

---

## Variables de Entorno

Usá `.env.example` como plantilla. Las variables más importantes:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Firma de tokens (generar con `openssl rand -base64 64`) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `MP_ACCESS_TOKEN` | Token de MercadoPago (producción = `APP_USR-...`) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del tunnel Cloudflare |
| `GROQ_API_KEY` | API Key para LLM por defecto |
| `GEMINI_API_KEY` | API Key para embeddings |

> 🔒 **Regla ADR-016**: Los archivos `.env` y `.env.local` NUNCA se commitean ni se modifican con scripts. Usá `cp .env.example .env` y editalos manualmente.

---

## Estructura del Proyecto

```
patasoft/
├── backend/          # NestJS (TypeScript, 30+ módulos, 22 modelos Prisma)
├── frontend/         # Vite + Vanilla JS (SPA, 13 secciones dashboard)
├── ai-service/       # FastAPI + LangChain (Python, RAG dual, streaming SSE)
├── docs/             # Documentación técnica (ADRs, FIX log, diagramas)
├── agent/            # Documentación para agentes de IA (CONTEXT, SKILL, SPECS)
├── shared/           # Tipos y constantes compartidas
├── scripts/          # server.sh (automatiza tunnel + backend + frontend)
├── docker-compose.yml # Infraestructura Docker local (postgres + redis + servicios)
├── render.yaml       # Config para futuro deploy a Render.com
└── TASKS.txt         # Backlog activo
```

---

## Licencia

MIT
