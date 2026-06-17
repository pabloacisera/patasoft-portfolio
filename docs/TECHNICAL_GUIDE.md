# PataSoft — Guía Técnica Completa

> **Versión:** 1.0
> **Propósito:** Documentación exhaustiva del sistema de gestión veterinaria PataSoft. Diseñada para que un desarrollador que se incorpora al proyecto pueda entender, mantener, debuggear y escalar la aplicación.
> **Audiencia:** Desarrolladores backend, frontend, DevOps y terceros integradores.

---

## Índice

1. [Introducción](#1-introducción)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Frontend — Arquitectura y Mapa de Funciones](#3-frontend--arquitectura-y-mapa-de-funciones)
4. [Backend — Arquitectura y Mapa de Módulos](#4-backend--arquitectura-y-mapa-de-módulos)
5. [Base de Datos — Schema y Relaciones](#5-base-de-datos--schema-y-relaciones)
6. [Sistemas de IA (RAG)](#6-sistemas-de-ia-rag)
7. [Decisiones Técnicas (ADRs)](#7-decisiones-técnicas-adrs)
8. [Mapa Exhaustivo de Funciones, Clases y Métodos](#8-mapa-exhaustivo-de-funciones-clases-y-métodos)
9. [Guía de Onboarding](#9-guía-de-onboarding)

---

## 1. Introducción

PataSoft es un sistema de gestión integral para clínicas veterinarias. Es una aplicación web SPA (Single Page Application) con arquitectura multi-tenant, donde cada clínica veterinaria es un "tenant" aislado por `companyId`.

### 1.1 Principios Arquitectónicos

| Principio | Descripción |
|-----------|-------------|
| **Multi-tenant** | Todos los clientes comparten la misma base de datos PostgreSQL. El aislamiento se logra mediante el campo `companyId` en cada entidad. |
| **Soft-delete** | Las entidades de negocio nunca se eliminan físicamente. Se marcan con `isDeleted = true` + `deletedAt`. |
| **Costo cero en IA** | El RAG se ejecuta localmente en NestJS usando Gemini (embeddings gratuitos) y Groq (LLM gratuito) para evitar pagar un servicio adicional en Render. |
| **Vanilla JS sin framework** | El frontend es JavaScript puro sin React/Vue/Angular, priorizando simplicidad y rendimiento. |
| **Modularidad NestJS** | El backend está organizado en 30 módulos con inyección de dependencias, guards y pipes globales. |

### 1.2 Diagramas de Referencia

Todos los diagramas Mermaid están en `docs/diagrams/`. Cada archivo `.mmd` contiene un único diagrama en sintaxis Mermaid pura. Para renderizar:

```bash
mmdc -i docs/diagrams/frontend/lifecycle.mmd -o diagrama.png -t dark -b transparent
# O todos a la vez:
docs/diagrams/render-all.sh
```

#### Frontend (`docs/diagrams/frontend/`)

| Diagrama | Archivo | Contenido |
|----------|---------|-----------|
| Ciclo de Vida SPA | `lifecycle.mmd` | `main.js` → `router.js` → páginas → componentes → API → stores |
| Flujo de Auth | `auth-sequence.mmd` | Login, tokens, refresh, Google OAuth (sequence) |
| Data Flow | `data-flow.mmd` | Click → loadData → api → store → DOM (graph LR) |
| Árbol de Componentes | `component-tree.mmd` | Layout → page-header → table → modal (graph TB) |
| WebSocket | `websocket.mmd` | Connect → rooms → eventos entrantes (sequence) |

#### Backend (`docs/diagrams/backend/`)

| Diagrama | Archivo | Contenido |
|----------|---------|-----------|
| Request Lifecycle | `request-lifecycle.mmd` | HTTP → CORS → Guards → Controller → Service → DB → Response |
| Módulos | `modules.mmd` | Dependencias entre 30 módulos NestJS |
| Pipeline RAG | `rag-pipeline.mmd` | Fuentes → CRUD → Local RAG / ai-service → LLM |
| Integraciones | `integrations.mmd` | MercadoPago, Cloudinary, Mailjet, Groq, Gemini |
| WebSocket Gateway | `websocket-gateway.mmd` | Connect → rooms → emit eventos (sequence) |
| Cron Jobs | `cron.mmd` | Tareas programadas diarias (gantt) |

#### Base de Datos (`docs/diagrams/database/`)

| Diagrama | Archivo | Contenido |
|----------|---------|-----------|
| ER Completo | `er-complete.mmd` | 22 modelos con todos los campos y relaciones |
| Enums | `enums.mmd` | Los 10 enums del schema Prisma |
| Multi-tenant | `multi-tenant.mmd` | Aislamiento por `companyId` en DB compartida |
| Soft-Delete | `soft-delete.mmd` | 7 entidades con `isDeleted` + regla de filtrado |
| pgvector | `pgvector.mmd` | Tabla `langchain_vectors` raw SQL fuera de Prisma |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Propósito | ADR |
|------|-----------|---------|-----------|-----|
| **Frontend** | Vite + Vanilla JS | 5.4.x | Build tool + SPA sin framework | ADR-001 |
| **Backend** | NestJS + TypeScript | 10.4.x | Framework backend modular | ADR-002 |
| **ORM** | Prisma | 5.22.x | Type-safe ORM con migraciones | ADR-003 |
| **Base de datos** | PostgreSQL 15 + pgvector | 15+ | Datos relacionales + búsqueda vectorial | ADR-004 |
| **Cache** | Redis | 7+ | Sesiones, rate limiting, cache de suscripción | - |
| **AI Service** (opcional) | FastAPI + Python | 0.115.x | LangChain Agent para modo PRO | ADR-005 |
| **LLM** | Groq (Llama 3.3 70B) | - | Chat IA con streaming | ADR-005 |
| **Embeddings** | Google Gemini | - | Embeddings 768 dimensiones para RAG | ADR-005 |
| **Pagos** | MercadoPago SDK | 2.12.x | Checkout Pro, QR, Suscripciones, Webhooks | ADR-008 |
| **Email** | Mailjet | 6.x | Transaccional: deudas, alertas, bienvenida | - |
| **Storage** | Cloudinary | 2.9.x | Imágenes de mascotas, PDFs, documentos | - |
| **Auth** | JWT + Passport.js | - | Access token (7d) + Refresh token (30d) en DB | ADR-010 |
| **WebSockets** | Socket.IO | 4.8.x | Notificaciones en tiempo real | - |
| **PDF** | Puppeteer + Handlebars | 22.x | Generación server-side de comprobantes | - |
| **Job Queue** | BullMQ + Redis | - | Procesamiento async de documentos | - |
| **Testing Backend** | Vitest | 4.x | Tests unitarios NestJS | ADR-012 |
| **Testing E2E** | Playwright | 1.60.x | Tests E2E en navegador real | ADR-013 |
| **Hosting** | Render.com | - | Web service + PostgreSQL + Redis free tier | ADR-007 |

---

## 3. Frontend — Arquitectura y Mapa de Funciones

### 3.1 Visión General

El frontend es una **SPA en Vanilla JavaScript** construida con **Vite**. No utiliza ningún framework de componentes (React, Vue, Angular). En su lugar, usa un **router casero con History API**, un **sistema de stores basado en observers con localStorage**, y **manipulación directa del DOM** mediante `innerHTML` y event delegation.

**Archivo raíz:** `frontend/index.html` → `frontend/src/main.js`

### 3.2 Estructura de Archivos

```
frontend/src/
  main.js                    # Bootstrap: auth check, router init, socket init
  router.js                  # History API Router (SPA sin hash)
  styles/main.css            # CSS único con custom properties (729 líneas)
  services/
    api.js                   # ApiClient class (fetch wrapper con auth + refresh)
    socket.js                # Socket.IO client (event emitter wrapper)
  stores/
    auth.store.js            # Auth state (localStorage)
    notifications.store.js   # Notifications state (localStorage)
  components/
    Modal.js                 # Sistema de modales apilables
    Toast.js                 # Notificaciones auto-dismiss
    StepForm.js              # Wizard multi-step
    SearchBar.js             # Búsqueda con debounce
    Pagination.js            # Paginación con elipsis
    FileUpload.js            # Drag & drop de archivos
    NotificationBell.js      # Campana + badge + dropdown
  pages/
    auth.js                  # Login, Register, AuthCallback
    dashboard.js             # Orchestrator de dashboard
    dashboard-additions.js   # Cargadores legacy (911 líneas)
    onboarding.js            # Wizard de 3 pasos (empresa)
    admin.js                 # Super admin panel
    sections/
      layout.js              # Sidebar + Topbar del dashboard
      home.js                # Dashboard home / stats
      clients.js             # CRUD clientes
      pets.js                # CRUD mascotas + fotos
      medical-records.js     # Consultas / historial clínico
      payments.js            # Pagos + deudas
      supplies.js            # Insumos / inventario (import/export Excel)
      cash-register.js       # Caja (ingresos/egresos)
      ai-chat.js             # Chat IA asistente
      connections.js         # Conexiones inter-veterinarias
      settings.js            # Configuración (empresa, suscripción, MP, precios, IA, export)
      super-admin.js         # Panel super admin (suscripciones)
  utils/
    validators.js            # Validadores de formularios
    formatters.js            # Formateo de moneda, fechas, estados
```

### 3.3 Flujo de Carga (main.js)

```
index.html
  └── <script type="module" src="/src/main.js">
        └── main.js:
              1. loadFromStorage() → rehidrata auth.store desde localStorage
              2. checkAuth() → si no autenticado y ruta no pública → redirect /login
              3. router.register(path, { render, public }) → define rutas
              4. router.init() → escucha popstate + intercepta clicks en <a>
              5. socket.connect() → conecta WebSocket con token JWT
```

### 3.4 Sistema de Routing (router.js)

```javascript
// Concepto: Objeto Router con registro de rutas + History API
router.register('/dashboard/clients', {
  render: () => import('./pages/sections/clients.js').then(m => m.renderClientsPage()),
  public: false  // requiere auth
})

// Navegación programática:
router.navigate('/dashboard/clients', pushState=true)

// Escucha:
window.addEventListener('popstate', handlePopState)
document.addEventListener('click', e => {
  if (e.target.matches('[data-link]')) {
    e.preventDefault()
    router.navigate(e.target.href)
  }
})
```

**Todas las rutas registradas** (desde `main.js`):

| Ruta | Página | Pública |
|------|--------|---------|
| `/login` | Login | Sí |
| `/register` | Register | Sí |
| `/auth/callback` | OAuth callback | Sí |
| `/onboarding` | Wizard empresa | No |
| `/dashboard/home` | Dashboard inicio | No |
| `/dashboard/clients` | Clientes | No |
| `/dashboard/pets` | Mascotas | No |
| `/dashboard/medical-records` | Historial clínico | No |
| `/dashboard/payments` | Pagos | No |
| `/dashboard/supplies` | Insumos | No |
| `/dashboard/ai-chat` | Chat IA | No |
| `/dashboard/cash-register` | Caja | No |
| `/dashboard/connections` | Conexiones | No |
| `/settings/company` | Config. empresa | No |
| `/settings/subscription` | Suscripción | No |
| `/settings/mercadopago` | MercadoPago | No |
| `/settings/prices` | Precios | No |
| `/settings/ai` | Config. IA | No |
| `/settings/connections` | Conexiones | No |
| `/settings/export-data` | Exportar datos | No |
| `/admin` | Super Admin | No |

### 3.5 Stores (Patrón Observer)

**auth.store.js** — Estado de autenticación:

| Variable | Tipo | Persistencia | Descripción |
|----------|------|-------------|-------------|
| `authState.user` | Object | `patasoft_auth` | Datos del usuario autenticado |
| `authState.token` | String | `patasoft_auth` | JWT access token (7d) |
| `authState.refreshToken` | String | `patasoft_auth` | JWT refresh token (30d) |
| `authState.company` | Object | `patasoft_company` | Datos de la clínica |
| `authState.isAuthenticated` | Boolean | - | Derivado de token != null |

| Función | Descripción |
|---------|-------------|
| `login(data)` | Guarda tokens + user, notifica suscriptores |
| `logout()` | Limpia localStorage, notifica, redirect /login |
| `setToken(token)` | Actualiza access token |
| `setUser(user)` | Actualiza user |
| `setCompany(company)` | Guarda empresa, notifica |
| `getToken()` | Retorna access token |
| `getRefreshToken()` | Retorna refresh token |
| `getUser()` | Retorna user |
| `getCompany()` | Retorna company |
| `isAuthenticated()` | Retorna boolean |
| `hasRole(role)` | Verifica rol del usuario |
| `subscribe(callback)` | Registra listener, retorna unsubscribe |

**notifications.store.js** — Notificaciones in-app:

| Variable | Tipo | Persistencia | Descripción |
|----------|------|-------------|-------------|
| `notificationsState.notifications` | Array | `patasoft_notifications` | Lista de notificaciones |
| `notificationsState.unreadCount` | Number | - | Contador de no leídas |

| Función | Descripción |
|---------|-------------|
| `add(notification)` | Agrega notificación, persiste, notifica |
| `markRead(id)` | Marca como leída |
| `markAllRead()` | Marca todas como leídas |
| `remove(id)` | Elimina notificación |
| `clear()` | Limpia todas |
| `setNotifications(arr)` | Reemplaza lista completa |
| `getUnreadCount()` | Retorna conteo |
| `subscribe(callback)` | Registra listener |

### 3.6 API Service (api.js)

```javascript
class ApiClient {
  constructor(baseURL = '/api/v1')
  async request(method, path, options)    // Método base: inyecta token, maneja 401
  async get(path, params)                  // GET request
  async post(path, data)                   // POST request
  async put(path, data)                    // PUT request
  async patch(path, data)                  // PATCH request
  async delete(path)                       // DELETE request
  async upload(path, formData)             // Multipart upload
  async download(path)                     // Download como blob
  async postFormData(path, formData)       // Form data POST
  async downloadAndSave(path, filename)    // Download + save local
  async getBlob(path)                      // GET como blob
}
```

**Mecanismo de Refresh Token:**
1. Request con token → 401
2. Si `isRefreshing` está en false, lo pone en true
3. POST `/api/v1/auth/refresh` con refreshToken
4. Si ok: actualiza token, reintenta request original
5. Si fail: `logout()` → redirect `/login`
6. Requests concurrentes durante refresh se encolan y reintentan

### 3.7 WebSocket (socket.js)

```javascript
// Conexión:
socket = io(backendUrl, {
  auth: { token: getToken() },
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
})

// Eventos entrantes del servidor:
socket.on('notification:new', data => notifStore.add(data))
socket.on('document:ready', ({ url, type }) => Toast.show(`Documento listo: ${type}`))
socket.on('stock:alert', supply => Toast.show(`Stock bajo: ${supply.name}`))
socket.on('debt:alert', debt => Toast.show(`Deuda: ${debt.amount}`))
socket.on('company:blocked', ({ reason }) => showBlockedScreen(reason))

// Funciones expuestas:
connect()
disconnect()
joinCompanyRoom(companyId)
leaveCompanyRoom(companyId)
on(event, callback)
off(event, callback)
emit(event, data)
```

### 3.8 Sistema de Componentes

Cada componente es una **función fábrica** que retorna un `HTMLElement` con métodos adjuntos.

**Modal.js:**
```javascript
createModal({ title, content, size?, buttons?, onConfirm?, onCancel? })
// Métodos en el elemento: .open(), .close(), .setContent(html)
// Soporte: apilable (z-index), Escape key, click outside
```

**Toast.js:**
```javascript
Toast.show(message, type='success'|'error'|'warning'|'info', duration=3000)
Toast.success(msg)
Toast.error(msg)
Toast.warning(msg)
Toast.info(msg)
// Auto-dismiss con barra de progreso
```

**StepForm.js:**
```javascript
createStepForm({ steps: [{ title, render, validate }], onComplete })
// Navegación: prev/next, barra de progreso, validación por paso
```

**SearchBar.js:**
```javascript
createSearchBar({ placeholder, onSearch, debounceMs=300 })
// Métodos: .getValue(), .clear(), .focus()
```

**Pagination.js:**
```javascript
createPagination({ currentPage, totalPages, totalItems, onChange })
// Features: elipsis, prev/next, info "Mostrando X-Y de Z"
```

**FileUpload.js:**
```javascript
createFileUpload({ accept, multiple, maxSize, onFiles })
// Drag & drop zone + click to browse + previews
```

**NotificationBell.js:**
```javascript
createNotificationBell()
// Badge con conteo, dropdown con lista, mark as read
```

### 3.9 Patrón de Páginas (Secciones)

Cada sección del dashboard sigue un patrón consistente:

```
┌─ loadClientsData() ──────────────────────┐
│  GET /api/v1/clients?page=X&search=Y     │
│  Guarda en pageData.clients               │
│  Llama renderClientsPage()                │
└───────────────────────────────────────────┘

┌─ renderClientsPage() ────────────────────┐
│  Renderiza: #page-content.innerHTML =     │
│    <div class="page-header">             │
│      SearchBar + Botón "Nuevo Cliente"   │
│    </div>                                │
│    <table class="data-table">            │
│      thead + tbody con data-action       │
│    </table>                              │
│    Pagination                            │
│  Attach event listeners (delegación)     │
└───────────────────────────────────────────┘

┌─ Event Handling (delegación) ────────────┐
│  document.querySelector('#page-content') │
│    .addEventListener('click', e => {     │
│      action = e.target.dataset.action    │
│      id = e.target.dataset.id           │
│      if action === 'edit' → openEditModal(id) │
│      if action === 'delete' → confirmDelete(id) │
│      if action === 'new' → openCreateModal()   │
│    })                                    │
└───────────────────────────────────────────┘
```

**Todas las secciones y sus funciones:**

| Archivo | Función load | Función render |
|---------|-------------|----------------|
| `clients.js` | `loadClientsData()` | `renderClientsPage()` |
| `pets.js` | `loadPetsData()` | `renderPetsPage()` |
| `medical-records.js` | `loadMedicalRecordsData()` | `renderMedicalRecordsPage()` |
| `payments.js` | `loadPaymentsData()` | `renderPaymentsPage()` |
| `supplies.js` | `loadSuppliesData()` | `renderSuppliesPage()` |
| `cash-register.js` | `loadCashRegisterData()` | `renderCashRegisterPage()` |

### 3.10 Funciones CRUD Internas por Sección

Cada sección define funciones privadas para operaciones CRUD. Patrón general:

```javascript
async function openCreateModal()
  → openModal({ title: "Nuevo Cliente", content: formHTML })
  → onConfirm: api.post('/clients', data) → loadClientsData() → Toast.success()

async function openEditModal(id)
  → api.get(`/clients/${id}`)
  → openModal({ title: "Editar Cliente", content: formHTML pre-filled })
  → onConfirm: api.patch(`/clients/${id}`, data) → loadClientsData() → Toast.success()

async function confirmDelete(id)
  → openModal({ title: "Confirmar", content: "¿Eliminar?" })
  → onConfirm: api.delete(`/clients/${id}`) → loadClientsData() → Toast.success()
```

### 3.11 Funciones Globales del Dashboard

**dashboard.js:**
| Función | Propósito |
|---------|-----------|
| `initDashboard()` | Configura sidebar, topbar, socket rooms, stats |
| `navigateToSection(section)` | Cambia sección activa, carga datos |
| `loadSectionData(section)` | Dispara loadXxxData según sección |
| `renderSection(section)` | Dispara renderXxxPage según sección |
| `debounce(fn, ms)` | Utilidad de debounce |

**layout.js:**
| Función | Propósito |
|---------|-----------|
| `renderSidebar()` | Renderiza menú lateral con secciones |
| `renderTopbar()` | Renderiza barra superior con NotificationBell + avatar |
| `updateActiveSection(section)` | Marca sección activa en sidebar |
| `toggleSidebar()` | Colapsa/expande sidebar en mobile |

---

## 4. Backend — Arquitectura y Mapa de Módulos

### 4.1 Visión General

Backend **NestJS** con **30 módulos**, organizado en dominios. Cada módulo contiene controller, service, dto y opcionalmente guards/decorators propios.

**Arquitectura de request:**

```
HTTP Request
  → CORS (whitelist)
  → Helmet (CSP, security headers)
  → ThrottlerGuard (100 req/60s)
  → JwtAuthGuard (valida JWT, carga user)
    → @Public()? → skip auth
    → Subscription check (Redis cache 5min)
    → Company check (onboarding?)
  → RolesGuard (@Roles() decorator)
  → ValidationPipe (class-validator: whitelist + forbidNonWhitelisted + transform)
  → Controller
  → Service
    → PrismaService
    → PostgreSQL
  → Response (200/201) o ExceptionFilter (400/403/404/500)
```

### 4.2 Módulos Core

| Módulo | Archivos Clave | Propósito |
|--------|---------------|-----------|
| **AuthModule** | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`, `google.strategy.ts` | Registro, login, JWT, Google OAuth, refresh tokens |
| **UsersModule** | `users.controller.ts`, `users.service.ts` | Gestión de usuarios, perfiles |
| **CompaniesModule** | `companies.controller.ts`, `companies.service.ts` | CRUD clínicas, onboarding |
| **PrismaModule** | `prisma.service.ts` | Cliente Prisma global (singleton) |
| **RedisModule** | `redis.service.ts` | Cliente Redis global (singleton) |
| **ConfigModule** | `env.validation.ts` | NestJS Config global con validación |

### 4.3 Módulos de Negocio

| Módulo | Controller Endpoints | Servicios Clave |
|--------|---------------------|-----------------|
| **Clients** | `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`, `GET /clients/:id/pets`, `GET /clients/:id/payments`, `GET /clients/:id/debts` | `create()`, `findAll()`, `findOne()`, `update()`, `remove()` |
| **Pets** | `GET/POST /pets`, `GET/PATCH/DELETE /pets/:id`, `GET /pets/:id/medical-records`, `POST /pets/:id/photos` | `create()`, `findAll()`, `findOne()`, `update()`, `remove()`, `uploadPhoto()` |
| **MedicalRecords** | `GET/POST /medical-records`, `GET/PATCH/DELETE /medical-records/:id` | `create()` (transacción atómica), `findAll()`, `findOne()`, `update()` |
| **Payments** | `GET/POST /payments`, `GET/PATCH/DELETE /payments/:id` | `create()`, `findAll()`, `findOne()`, `update()`, `generateCheckout()` |
| **Debts** | `GET/POST /debts`, `GET/PATCH/DELETE /debts/:id`, `POST /debts/:id/pay` | `create()`, `findAll()`, `findOne()`, `update()`, `pay()`, `calculateDebtAmount()`, `processAlerts()` |
| **Supplies** | `GET/POST /supplies`, `GET/PATCH/DELETE /supplies/:id`, `GET /supplies/low-stock`, `POST /supplies/import`, `GET /supplies/export` | `create()`, `findAll()`, `importExcel()`, `exportExcel()` |
| **PriceItems** | `GET/POST /price-items`, `GET/PATCH/DELETE /price-items/:id` | `create()`, `findAll()`, `update()` |
| **CashRegister** | `GET/POST /cash-register`, `GET /cash-register/summary` | `create()`, `findAll()`, `getSummary()`, `createFromPayment()` |
| **Notifications** | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | `findAll()`, `markRead()`, `markAllRead()`, `create()` |

### 4.4 Módulos de Integración

| Módulo | Propósito | Endpoints Clave |
|--------|-----------|-----------------|
| **MercadopagoModule** | Pagos con MercadoPago | `POST /mercadopago/preference`, `POST /mercadopago/qr`, `POST /mercadopago/webhook`, `GET /mercadopago/status/:id`, `GET /mercadopago/oauth/connect`, `GET /mercadopago/oauth/callback`, `GET /mercadopago/oauth/status` |
| **AiProxyModule** | Chat IA + RAG | `POST /ai/chat`, `POST /ai/chat/stream`, `POST /ai/transcribe`, `GET /ai/models`, `POST /ai/rag/upload`, `POST /ai/rag/sync`, `GET /ai/rag/status` |
| **PdfModule** | Generación de PDFs | `GET /pdf/pet-card/:id`, `GET /pdf/receipt/:id` |
| **CloudinaryModule** | Upload de imágenes | (usado internamente por PetsModule y DocumentsModule) |
| **MailModule** | Emails transaccionales | (usado internamente por DebtsModule, AuthModule) |
| **EventsModule** | WebSocket Gateway | (eventos en tiempo real, no REST) |

### 4.5 Módulos de Administración

| Módulo | Propósito |
|--------|-----------|
| **AdminModule** | Panel super admin: listar empresas, bloquear/desbloquear |
| **SuperAdminModule** | Utilidades adicionales para super admin |
| **CronModule** | Tareas programadas: alertas de deudas (8AM), expiración de suscripciones (10AM), stock bajo (2PM), limpieza refresh tokens (4PM) |
| **DataModule** | Exportación/importación de datos completos de la empresa |
| **SupplyPurchasesModule** | Órdenes de compra de insumos |
| **ConnectionsModule** | Conexiones inter-empresas (red federada) |
| **GuestModule** | Sesiones de invitados (usuarios no registrados vía localStorage) |
| **QueuesModule** | Colas BullMQ para procesamiento asíncrono |

### 4.6 Guards y Decorators

| Archivo | Nombre | Propósito |
|---------|--------|-----------|
| `auth/guards/jwt-auth.guard.ts` | `JwtAuthGuard` | Valida JWT, verifica suscripción, inyecta companyId |
| `auth/guards/roles.guard.ts` | `RolesGuard` | Verifica rol del usuario contra `@Roles()` |
| `auth/guards/throttler.guard.ts` | `ThrottlerGuard` | Rate limiting global |
| `common/decorators/current-user.decorator.ts` | `@CurrentUser()` | Inyecta usuario autenticado |
| `common/decorators/public.decorator.ts` | `@Public()` | Marca ruta como pública (skip JWT) |
| `common/decorators/roles.decorator.ts` | `@Roles()` | Define roles permitidos |
| `common/filters/all-exceptions.filter.ts` | `AllExceptionsFilter` | Captura todas las excepciones no manejadas |

### 4.7 Servicios Compartidos

| Servicio | Propósito |
|----------|-----------|
| `PrismaService` | Singleton de PrismaClient, maneja conexión lifecycle |
| `RedisService` | Singleton de Redis client, cache, sesiones |
| `EventsGateway` | WebSocket gateway, emisión a rooms de empresa/usuario |
| `LocalRagService` | RAG en NestJS: embeddings Gemini + pgvector + Groq |
| `RagIngestionService` | Sincroniza datos de la empresa con pgvector |

---

## 5. Base de Datos — Schema y Relaciones

### 5.1 Esquema General

**ORM:** Prisma 5.22
**Schema:** `backend/prisma/schema.prisma`
**Migraciones:** `backend/prisma/migrations/` (2 migraciones)
**Base de datos:** PostgreSQL 15 + pgvector

### 5.2 Modelos (22 total)

| # | Modelo | Descripción | Soft-delete | Multi-tenant |
|---|--------|-------------|-------------|--------------|
| 1 | `Company` | Clínica veterinaria | No | N/A (es el tenant) |
| 2 | `CompanyConfig` | Configuración de la clínica | No | 1:1 con Company |
| 3 | `User` | Usuario del sistema | No | FK a Company |
| 4 | `RefreshToken` | JWT refresh token | No | FK a User |
| 5 | `Subscription` | Plan de suscripción | No | 1:1 con Company |
| 6 | `Client` | Dueño de mascota | Sí | FK companyId |
| 7 | `Pet` | Mascota | Sí | FK companyId |
| 8 | `PetPhoto` | Foto de mascota en Cloudinary | No | FK a Pet |
| 9 | `MedicalRecord` | Consulta veterinaria | Sí | FK companyId |
| 10 | `Procedure` | Procedimiento en consulta | No | FK medicalRecordId |
| 11 | `Prescription` | Receta médica | No | FK medicalRecordId |
| 12 | `PriceItem` | Ítem de precio (catálogo) | No | FK companyId |
| 13 | `Payment` | Pago/Factura | Sí | FK companyId |
| 14 | `PaymentItem` | Línea de pago | No | FK paymentId |
| 15 | `Debt` | Deuda/Cuenta por cobrar | Sí | FK companyId |
| 16 | `Supply` | Insumo/Producto en stock | Sí | FK companyId |
| 17 | `SupplyPurchase` | Compra de insumos | No | FK supplyId |
| 18 | `Document` | Documento (PDF, Excel) | Sí | FK companyId |
| 19 | `Notification` | Notificación in-app | No | FK companyId |
| 20 | `CompanyConnection` | Conexión inter-empresas | No | FK companyId |
| 21 | `CashMovement` | Movimiento de caja | No | FK companyId |
| 22 | `GlobalConfig` | Configuración global del sistema | No | N/A |

### 5.3 Relaciones Clave

```
Company 1──1 CompanyConfig
Company 1──1 Subscription
Company 1──* User → RefreshToken
Company 1──* Client
Company 1──* Pet → PetPhoto
Company 1──* PriceItem
Company 1──* Supply → SupplyPurchase
Company 1──* Payment → PaymentItem
Company 1──* Debt
Company 1──* CashMovement
Company 1──* Notification
Company *──* CompanyConnection (auto-referencial)

Client 1──* Pet
Client 1──* Payment
Client 1──* Debt

Pet 1──* MedicalRecord → Procedure
Pet 1──* MedicalRecord → Prescription
MedicalRecord 1──0|1 Payment (unique)

Payment 0|1──1 Debt
Procedure *──0|1 PriceItem
Procedure *──0|1 Supply
Prescription *──0|1 Supply
```

### 5.4 Enums (10)

| Enum | Valores |
|------|---------|
| `UserRole` | `GUEST`, `USER`, `ADMIN_COMPANY`, `STAFF`, `SUPER_ADMIN` |
| `SubscriptionPlan` | `TRIAL`, `MONTHLY`, `YEARLY`, `TEST` |
| `SubscriptionStatus` | `TRIAL`, `ACTIVE`, `EXPIRED`, `BLOCKED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `PARTIAL`, `PAID`, `DEFERRED`, `CANCELLED`, `OVERDUE` |
| `PaymentMethod` | `CASH`, `TRANSFER`, `MP_QR`, `MP_CHECKOUT`, `CHECK`, `OTHER` |
| `DebtStatus` | `PENDING`, `PAID`, `OVERDUE`, `CANCELLED` |
| `ConnectionStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED` |
| `CashMovementType` | `INCOME`, `EXPENSE` |
| `DocumentType` | `PAYMENT_RECEIPT`, `DEBT_RECORD`, `SUPPLY_EXCEL`, `PRICE_LIST`, `RAG_DOCUMENT`, `EXPORT_EXCEL`, `EXPORT_PDF`, `ACCOUNT_STATEMENT` |
| `NotificationType` | `STOCK_LOW`, `DEBT_DUE`, `DEBT_OVERDUE`, `CONNECTION_REQUEST`, `CONNECTION_ACCEPTED`, `CONNECTION_REJECTED`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`, `MIGRATION_COMPLETE`, `ONBOARDING_INCOMPLETE`, `DOCUMENT_READY`, `SYSTEM` |

### 5.5 Tabla pgvector (fuera de Prisma)

La tabla `langchain_vectors` se gestiona con SQL raw a través de `pg.Pool` porque Prisma no soporta columnas vectoriales nativamente.

```sql
CREATE TABLE langchain_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(768),
  company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_langchain_vectors_company ON langchain_vectors (company_id);
CREATE INDEX idx_langchain_vectors_embedding ON langchain_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 5.6 Patrón Multi-tenant

Todas las entidades de negocio tienen un campo `companyId` que las asocia a su clínica. El `JwtAuthGuard` inyecta el `companyId` del token en cada request, y los servicios filtran por él:

```typescript
// Ejemplo en todos los servicios:
return this.prisma.client.findMany({
  where: { companyId: currentCompanyId, isDeleted: false }
});
```

### 5.7 Patrón Soft-delete

7 entidades implementan soft-delete: `Client`, `Pet`, `MedicalRecord`, `Payment`, `Debt`, `Supply`, `Document`.

```typescript
// Cada query debe incluir:
where: { isDeleted: false }

// El servicio de eliminación:
async remove(id: string) {
  return this.prisma.client.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() }
  });
}
```

---

## 6. Sistemas de IA (RAG)

### 6.1 Visión General — Dual Architecture

PataSoft tiene **dos sistemas de IA** independientes que resuelven el mismo problema (asistente veterinario con RAG) pero con diferentes niveles de sofisticación y costo:

| Aspecto | Sistema A: Local RAG (NestJS) | Sistema B: ai-service (Python) |
|---------|-------------------------------|-------------------------------|
| **Ubicación** | Dentro del proceso NestJS | Servicio separado (FastAPI) |
| **Costo** | $0 (Gemini gratis + Groq gratis) | ~$7/mes en Render + costo LLM |
| **Vector DB** | pgvector en PostgreSQL existente | ChromaDB (archivos en disco) |
| **LLM** | Groq llama-3.3-70b-versatile | OpenAI GPT-4o / Groq / Gemini |
| **Embeddings** | Google Gemini embedding-2-preview (768d) | Gemini embedding-001 / OpenAI |
| **LangChain** | No | Sí (Agent con 6 tools + Redis memory) |
| **Tiene Tools** | No (solo RAG) | Sí (consulta DB directamente) |
| **Calidad respuestas** | Buena (RAG básico) | Excelente (Agent + Tools + memoria) |
| **Estado** | ✅ Implementado y funcional | 🟡 Implementado, listo para activar |

### 6.2 La Decisión Estratégica (ADR-005)

**Contexto:** El ai-service de Python corre como un web service separado en Render.com, lo que cuesta aproximadamente **$7/mes adicionales** (más el costo de LLM si usa OpenAI).

**Decisión:** Implementar primero el RAG local en NestJS para evitar ese costo mientras la aplicación no tenga escala. Cuando la aplicación crezca y justifique el gasto, se activa el ai-service.

**Estado actual:** El código en `ai-proxy.service.ts` tiene `SCALE_MODE` con default `'local'`, lo que hace que *por defecto* use el RAG local de NestJS (pgvector + Groq) sin necesidad del ai-service Python. Esto alinea el código con ADR-005 (modo local como default para ahorrar costos).

### 6.3 Arquitectura del Sistema A: Local RAG (NestJS)

Este es el sistema que corre **dentro del proceso NestJS**, sin servicios externos adicionales (más allá de las APIs gratuitas de Google Gemini y Groq).

#### 6.3.1 Archivos del Módulo

| Archivo | Rol |
|---------|-----|
| `backend/src/ai-proxy/ai-proxy.module.ts` | Declara el módulo, provee los 3 servicios |
| `backend/src/ai-proxy/ai-proxy.controller.ts` | Endpoints REST: `/chat`, `/chat/stream`, `/rag/sync`, etc. |
| `backend/src/ai-proxy/ai-proxy.service.ts` | **Router**: decide entre local y ai-service según `SCALE_MODE` |
| `backend/src/ai-proxy/local-rag.service.ts` | **Motor RAG**: embeddings, pgvector, Groq LLM |
| `backend/src/ai-proxy/rag-ingestion.service.ts` | **Sincronización**: lee 7 categorías y las envía al RAG |
| `backend/src/ai-proxy/dto/ai-proxy.dto.ts` | DTOs: `ChatMessageDto`, `ChatDto`, `TranscribeDto` |

#### 6.3.2 Pipeline Completo del RAG Local

```
1. INGESTIÓN (manual o automática)
   Usuario → Settings > IA > "Sincronizar datos"
   → POST /api/v1/ai/rag/sync
   → RagIngestionService.ingestCompanyData()
       → Lee 7 categorías de PostgreSQL vía Prisma
       → Construye textos descriptivos con metadata
       → DELETE viejo contenido de la empresa
       → Batches de 5 docs → embed → INSERT pgvector

2. EMBEDDING
   Google Gemini → gemini-embedding-2-preview
   → text → float[768] (768 dimensiones)
   → SDK: @google/genai (NPM)

3. ALMACENAMIENTO VECTORIAL
   Tabla: langchain_vectors (PostgreSQL + pgvector)
   Columnas: content (TEXT), metadata (JSONB),
              embedding (VECTOR(768)), company_id (INTEGER)
   Índice: IVFFLAT con cosine distance

4. CONSULTA (cuando el usuario pregunta algo)
   POST /api/v1/ai/chat/stream { message, history }
   → LocalRagService.queryStream()
       a) Embed la pregunta del usuario (Gemini, 768d)
       b) pgvector similarity search:
            SELECT content FROM langchain_vectors
            WHERE company_id = $1
            ORDER BY embedding <=> $2::vector
            LIMIT 15
       c) Construye system prompt con los 15 docs
       d) Llama a Groq (llama-3.3-70b-versatile) con streaming
       e) Retorna SSE al frontend

5. ACTUALIZACIÓN AUTOMÁTICA (en cada CRUD)
   Cada create/update/delete en:
   - Clients → upsertEmbedding / deleteEmbedding
   - Pets → upsertEmbedding / deleteEmbedding
   - Supplies → upsertEmbedding / deleteEmbedding
   - PriceItems → upsertEmbedding / deleteEmbedding
   - MedicalRecords → upsertEmbedding / deleteEmbedding
```

#### 6.3.3 System Prompt

```
SOS UN ASISTENTE VETERINARIO. Tu trabajo es responder preguntas
sobre los datos de la veterinaria que administras.

DATOS DE LA VETERINARIA:
{contexto de 15 documentos}

INSTRUCCIONES:
- Lee TODOS los datos proporcionados arriba antes de responder.
- Si la pregunta es sobre inventory/stock/cantidad/precio de algo,
  busca esa información específica en los datos.
- Nombra exactamente qué productos/cantidades encontraste en los datos.
- Si no hay información en los datos, decilo claramente:
  "No tengo esa información en los datos de la veterinaria."
- NO inventes información que no esté en los datos.
- Responde en español argentino, de forma clara y directa.
```

Sin contexto RAG (no hay datos sincronizados):
```
Sos un asistente veterinario especializado. Responde preguntas sobre
medicina veterinaria, animales y cuidado de mascotas en español argentino.
```

#### 6.3.4 Mecanismo de Sincronización Automática

Cada servicio CRUD inyecta `LocalRagService` y llama a `upsertEmbedding` después de cada operación:

```typescript
// Ejemplo en clients.service.ts:
async create(dto: CreateClientDto, companyId: string) {
  const client = await this.prisma.client.create({
    data: { ...dto, companyId }
  });
  // Sincronización RAG asíncrona (fire-and-forget)
  this.rag.upsertEmbedding(companyId, buildClientText(client), {
    clientId: client.id, companyId
  }).catch(e => this.logger.error('RAG sync failed', e));
  return client;
}
```

| Entidad | Texto generado para embedding |
|---------|------------------------------|
| Company | `"Empresa: {name}, email: {email}, dirección: {address}, especialidades: {specialties}"` |
| Client | `"Cliente: {name} {lastName}, DNI: {dni}, email: {email}, tel: {phone}"` |
| Pet | `"Mascota: {name}, especie: {species}, raza: {breed}, dueño: {clientName}"` |
| Supply | `"Insumo: {name}, marca: {brand}, stock: {quantity}/{minQuantity}, precio: ${salePrice}"` |
| PriceItem | `"Servicio: {name}, categoría: {category}, precio: ${price}"` |
| MedicalRecord | `"Consulta: {date}, motivo: {visitReason}, diagnóstico: {diagnosis}, mascota: {petName}"` |
| Payment | `"Pago: ${totalAmount}, método: {method}, estado: {status}, cliente: {clientName}"` |

#### 6.3.5 Parámetros de Configuración (Local RAG)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `GEMINI_API_KEY` | (requerido) | API Key de Google Gemini para embeddings |
| `GROQ_API_KEY` | (requerido) | API Key de Groq para LLM |
| `GROQ_MODEL_DEFAULT` | `llama-3.3-70b-versatile` | Modelo de Groq para chat |
| `VECTOR_DIMENSION` | `768` | Dimensiones del embedding Gemini |
| `EMBEDDINGS_MODEL` | `gemini-embedding-2-preview` | Modelo de embeddings |

### 6.4 Arquitectura del Sistema B: ai-service (Python + FastAPI + LangChain)

Este es el sistema **más completo** pero requiere un servicio separado corriendo en Render.com (~$7/mes).

#### 6.4.1 Archivos del Servicio

```
ai-service/
  app/
    main.py                    # Entrypoint FastAPI, CORS, API Key middleware
    api/
      chat.py                  # LangChain Agent con 6 tools + streaming
      rag.py                   # ChromaDB RAG (ingesta, query, delete)
      transcription.py         # Whisper transcripción de audio
      company.py               # Configuración de IA por empresa
    models/
      chat.py                  # Pydantic models
    tools/
      __init__.py              # 6 LangChain tools
    memory/
      __init__.py              # Redis conversation memory
    db/
      __init__.py              # DB connection (SQLAlchemy)
  requirements.txt
  Dockerfile
  tests/
    conftest.py
    test_auth.py
    test_health.py
```

#### 6.4.2 LangChain Agent con 6 Tools

El agente de LangChain puede **consultar la base de datos directamente** usando SQLAlchemy con SQL raw. Esto le da capacidad de responder preguntas que el RAG puro no puede (ej: "¿cuántos perros atendí la semana pasada?").

| Tool | Nombre | Función | Query SQL |
|------|--------|---------|-----------|
| `GetPetsTool` | `get_pets` | Busca mascotas por nombre/especie/dueño | `SELECT * FROM "Pet" WHERE "companyId"=$1 ...` |
| `GetClientsTool` | `get_clients` | Busca clientes por nombre/email/DNI | `SELECT * FROM "Client" WHERE "companyId"=$1 ...` |
| `GetMedicalRecordsTool` | `get_medical_records` | Obtiene historial de una mascota | `SELECT * FROM "MedicalRecord" WHERE "petId"=$1` |
| `GetSuppliesTool` | `get_supplies` | Busca insumos (con filtro low_stock) | `SELECT * FROM "Supply" WHERE "companyId"=$1 ...` |
| `GetDebtsTool` | `get_debts` | Busca deudas pendientes | `SELECT d.*, c.name FROM "Debt" d JOIN "Client" c ...` |
| `GetPaymentsTool` | `get_payments` | Busca pagos con items | `SELECT p.*, pi.* FROM "Payment" p JOIN "PaymentItem" pi ...` |

**Importante:** Las tools usan **SQLAlchemy** con SQL raw directamente sobre PostgreSQL, **sin pasar por Prisma**. Esto significa que el ai-service necesita conexión directa a la base de datos.

#### 6.4.3 ChromaDB en el ai-service

**ChromaDB** es la base de datos vectorial del ai-service:

```
                    ┌─────────────────────────┐
                    │   ChromaDB persistente   │
                    │   ./chroma_db/           │
                    │                          │
                    │   Colecciones:           │
                    │   ┌──────────────────┐   │
                    │   │ company_abc123   │   │
                    │   │ company_def456   │   │
                    │   │ company_ghi789   │   │
                    │   └──────────────────┘   │
                    │                          │
                    │   Persistencia: disco    │
                    └──────────────────────────┘
```

- **Embeddings:** `GoogleGenerativeAIEmbeddings` (`gemini-embedding-001`) o `OpenAIEmbeddings` (`text-embedding-3-small`)
- **Chunking:** `RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)`
- **Aislamiento:** Una colección `company_{companyId}` por empresa

#### 6.4.4 Memory en Redis

```python
# Prefijo de keys en Redis:
ai_memory:{company_id}:{session_id}

# Cada entrada:
{
  "role": "human" | "assistant",
  "content": "..."
}
```

#### 6.4.5 Parámetros de Configuración (ai-service)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `AI_SERVICE_URL` | `http://localhost:8000` | URL del ai-service |
| `AI_SERVICE_API_KEY` | - | API Key para autenticación |
| `OPENAI_API_KEY` | - | Para GPT-4o (default en ai-service) |
| `GROQ_API_KEY` | - | Para Groq LLM |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | Directorio de persistencia ChromaDB |
| `EMBEDDINGS_MODEL` | `gemini-embedding-001` | Modelo de embeddings |

### 6.5 Cómo se Rutéa entre Ambos Sistemas

El ruteo se controla mediante la variable de entorno `SCALE_MODE` en `ai-proxy.service.ts`:

```typescript
// ai-proxy.service.ts (línea ~20)
this.scaleMode = this.config.get<string>('SCALE_MODE') || 'local';
```

| SCALE_MODE | Qué usa | Cuándo usarlo |
|------------|---------|---------------|
| `'PRO'` | ai-service Python (FastAPI + LangChain) | Cuando el ai-service está desplegado en Render |
| cualquier otro valor (ej: `'local'`) | Local RAG en NestJS (pgvector + Groq) | Para desarrollo local o producción sin ai-service |

**Tabla de ruteo completa:**

| Endpoint | SCALE_MODE=PRO | SCALE_MODE=local |
|----------|----------------|------------------|
| `POST /ai/chat` | Proxy a `{ai-service}/api/v1/chat` | `LocalRagService.query()` |
| `POST /ai/chat/stream` | Proxy a `{ai-service}/api/v1/chat/stream` | `LocalRagService.queryStream()` (Groq streaming real) |
| `POST /ai/rag/sync` | Proxy a `{ai-service}/api/v1/rag/documents` | `LocalRagService.addDocuments()` |
| `POST /ai/rag/upload` | Proxy a `{ai-service}/api/v1/rag/documents` | `LocalRagService.addDocuments()` |
| `GET /ai/rag/status` | Proxy a `{ai-service}/api/v1/rag/status/{id}` | `{ synced: true, mode: 'local' }` |
| `POST /ai/transcribe` | Proxy a `{ai-service}/api/v1/transcribe` | Proxy a `{ai-service}/...` (no hay local) |
| `GET /ai/models` | Proxy a `{ai-service}/api/v1/models` | Lista hardcodeada de modelos |

### 6.6 Comparación de Capacidades

| Capacidad | Local RAG (NestJS) | ai-service (Python) |
|-----------|-------------------|---------------------|
| Responder sobre datos sincronizados | ✅ Sí (RAG básico) | ✅ Sí (RAG + Tools) |
| Responder preguntas de análisis | ❌ No (solo lo que está en los embeddings) | ✅ Sí (tools consultan DB directo) |
| "¿Cuántos perros atendí ayer?" | ❌ | ✅ (GetMedicalRecordsTool) |
| "¿Qué insumos están por vencer?" | ❌ | ✅ (GetSuppliesTool) |
| "¿Quiénes me deben plata?" | ❌ | ✅ (GetDebtsTool) |
| Streaming de respuesta | ✅ Sí (Groq nativo) | ✅ Sí (simulado) |
| Memoria conversacional | ❌ No | ✅ Sí (Redis) |
| Transcripción de audio | ❌ No | ✅ Sí (Whisper) |
| Costo de infraestructura | $0 | ~$7/mes + LLM |
| Costo de LLM | $0 (Groq free tier) | $0 (Groq) o $$$ (OpenAI) |

### 6.7 Recomendación de Uso

```
┌─ ¿La app tiene menos de 50 clientes? ──→ Usar Local RAG (SCALE_MODE=local)
│                                            ● $0 de infraestructura extra
│                                            ● Suficiente para consultas básicas
│                                            ● Configurar .env correctamente
│
└─ ¿La app está creciendo o necesita ───→ Usar ai-service (SCALE_MODE=PRO)
  respuestas más inteligentes?               ● Desplegar ai-service en Render
                                             ● Configurar AI_SERVICE_URL
                                             ● Activar OpenAI si se desea GPT-4o
```

### 6.8 Mapa de Funciones — Sistema de IA

#### NestJS Local RAG

| Archivo | Función/Método | Línea | Propósito |
|---------|---------------|-------|-----------|
| `local-rag.service.ts` | `onModuleInit()` | ~22 | Inicializa Groq, Gemini y pg Pool |
| `local-rag.service.ts` | `embed(text)` | ~56 | Genera embedding Gemini 768d |
| `local-rag.service.ts` | `upsertEmbedding(companyId, content, metadata)` | ~75 | DELETE + INSERT embedding |
| `local-rag.service.ts` | `deleteEmbedding(companyId, metadata)` | ~100 | DELETE embedding por metadata |
| `local-rag.service.ts` | `addDocuments(companyId, documents)` | ~118 | Ingesta batch con retry |
| `local-rag.service.ts` | `similaritySearch(companyId, query, k)` | ~155 | pgvector cosine distance query |
| `local-rag.service.ts` | `query(companyId, message, history)` | ~175 | Chat completo sin streaming |
| `local-rag.service.ts` | `queryStream(companyId, message, history)` | ~210 | Chat con streaming SSE |
| `local-rag.service.ts` | `buildSystemPrompt(context)` | ~260 | Construye prompt con contexto |
| `rag-ingestion.service.ts` | `ingestCompanyData(companyId, progressCb)` | ~20 | Lee 7 categorías y envía al RAG |
| `ai-proxy.service.ts` | `chat(companyId, dto)` | ~85 | Router: local vs PRO |
| `ai-proxy.service.ts` | `sendToRag(companyId, documents, cb)` | ~130 | Envía documentos al RAG |
| `ai-proxy.service.ts` | `uploadRag(companyId, files)` | ~160 | Sube archivos al RAG |
| `ai-proxy.service.ts` | `transcribe(file)` | ~180 | Proxy de transcripción |
| `ai-proxy.service.ts` | `getModels()` | ~190 | Lista modelos disponibles |
| `ai-proxy.controller.ts` | `chat()` | ~30 | POST /ai/chat |
| `ai-proxy.controller.ts` | `chatStream()` | ~50 | POST /ai/chat/stream (SSE) |
| `ai-proxy.controller.ts` | `ragSync()` | ~90 | POST /ai/rag/sync |
| `ai-proxy.controller.ts` | `ragSyncStream()` | ~110 | POST /ai/rag/sync (SSE) |

#### Servicios CRUD que disparan RAG sync

| Archivo | Método | Línea | Evento |
|---------|--------|-------|--------|
| `clients.service.ts` | `create()` | ~80 | `this.rag.upsertEmbedding(...)` |
| `clients.service.ts` | `update()` | ~108 | `this.rag.upsertEmbedding(...)` |
| `clients.service.ts` | `remove()` | ~124 | `this.rag.deleteEmbedding(...)` |
| `pets.service.ts` | `create()` | ~97 | `this.rag.upsertEmbedding(...)` |
| `pets.service.ts` | `update()` | ~133 | `this.rag.upsertEmbedding(...)` |
| `pets.service.ts` | `remove()` | ~148 | `this.rag.deleteEmbedding(...)` |
| `supplies.service.ts` | `create()` | ~83 | `this.rag.upsertEmbedding(...)` |
| `supplies.service.ts` | `update()` | ~102 | `this.rag.upsertEmbedding(...)` |
| `supplies.service.ts` | `remove()` | ~112 | `this.rag.deleteEmbedding(...)` |
| `price-items.service.ts` | `create()` | ~82 | `this.rag.upsertEmbedding(...)` |
| `price-items.service.ts` | `update()` | ~95 | `this.rag.upsertEmbedding(...)` |
| `price-items.service.ts` | `remove()` | ~105 | `this.rag.deleteEmbedding(...)` |
| `medical-records.service.ts` | `create()` | ~272 | `this.rag.upsertEmbedding(...)` |
| `medical-records.service.ts` | `update()` | ~306 | `this.rag.upsertEmbedding(...)` |
| `medical-records.service.ts` | `remove()` | ~316 | `this.rag.deleteEmbedding(...)` |

#### Python ai-service

| Archivo | Función | Propósito |
|---------|---------|-----------|
| `app/main.py` | `verify_api_key()` | Middleware de autenticación |
| `app/main.py` | `startup()` | Verifica APIs, crea directorios |
| `app/api/chat.py` | `chat()` | POST /api/v1/chat — LangChain Agent |
| `app/api/chat.py` | `chat_stream()` | POST /api/v1/chat/stream — SSE |
| `app/api/chat.py` | `get_models()` | GET /api/v1/models |
| `app/api/chat.py` | `get_tools()` | GET /api/v1/tools |
| `app/api/chat.py` | `clear_memory()` | DELETE /api/v1/memory |
| `app/api/rag.py` | `add_documents()` | POST /api/v1/rag/documents — ChromaDB ingest |
| `app/api/rag.py` | `query_rag()` | POST /api/v1/rag/query — ChromaDB search + LLM |
| `app/api/rag.py` | `delete_company_docs()` | DELETE /api/v1/rag/documents/{companyId} |
| `app/api/rag.py` | `get_rag_status()` | GET /api/v1/rag/status/{companyId} |
| `app/api/rag.py` | `get_or_create_collection()` | Crea/obtiene colección ChromaDB por company |
| `app/api/transcription.py` | `transcribe_audio()` | POST /api/v1/transcribe — Whisper |
| `app/api/company.py` | `get_company_config()` | GET /api/v1/company/{companyId}/config |
| `app/api/company.py` | `update_company_config()` | PUT /api/v1/company/{companyId}/config |
| `app/tools/__init__.py` | `GetPetsTool` | Tool: buscar mascotas |
| `app/tools/__init__.py` | `GetClientsTool` | Tool: buscar clientes |
| `app/tools/__init__.py` | `GetMedicalRecordsTool` | Tool: historial médico |
| `app/tools/__init__.py` | `GetSuppliesTool` | Tool: insumos/stock |
| `app/tools/__init__.py` | `GetDebtsTool` | Tool: deudas pendientes |
| `app/tools/__init__.py` | `GetPaymentsTool` | Tool: pagos |
| `app/memory/__init__.py` | `get_memory()` | Obtiene/setea memoria Redis por sesión |

---

## 7. Decisiones Técnicas (ADRs)

Este documento complementa `docs/DECISIONS.md`. A continuación, los ADRs adicionales no documentados allí, y referencias cruzadas.

### 7.1 Resumen de ADRs en DECISIONS.md

| ADR | Título | Estado |
|-----|--------|--------|
| ADR-001 | Vanilla JS sin framework frontend | ✅ Aceptada |
| ADR-002 | NestJS como backend | ✅ Aceptada |
| ADR-003 | Prisma como ORM | ✅ Aceptada |
| ADR-004 | pgvector en vez de ChromaDB/Pinecone | ✅ Aceptada |
| ADR-005 | LangChain dentro de NestJS (no ai-service) para inicio | ✅ Aceptada |
| ADR-006 | Multi-tenant por companyId (shared DB) | ✅ Aceptada |
| ADR-007 | Render.com como hosting | ✅ Aceptada |
| ADR-008 | MercadoPago para pagos y suscripciones | ✅ Aceptada |
| ADR-009 | Soft-delete en entidades de negocio | ✅ Aceptada |
| ADR-010 | JWT con refresh token en DB | ✅ Aceptada |
| ADR-011 | Sin Docker en producción | ✅ Aceptada |
| ADR-012 | Vitest sobre Jest para testing | ✅ Aceptada |
| ADR-013 | Playwright E2E sobre Vitest+jsdom | ✅ Aceptada |

### 7.2 ADRs Adicionales

#### ADR-014: Socket.IO para tiempo real

**Estado:** Aceptada
**Fecha:** 2025

**Contexto:** Se necesita notificar en tiempo real a los usuarios cuando ocurren eventos (pago confirmado, deuda vencida, stock bajo, documento listo).

**Decisión:** Usar Socket.IO con transporte WebSocket + polling fallback, integrado como gateway de NestJS.

**Razón:**
- Soporte nativo en NestJS (`@nestjs/platform-socket.io`)
- Fallback automático a polling cuando WebSocket no está disponible
- Rooms por companyId para aislamiento multi-tenant
- Reconexión automática con backoff

**Consecuencias:**
- Positivas: Tiempo real sin polling HTTP, fácil de usar
- Negativas: Conexión permanente por usuario, sticky sessions en escalado horizontal

---

#### ADR-015: Vanilla JS sin React — Justificación Reforzada

**Estado:** Aceptada (complementa ADR-001)
**Fecha:** 2026

**Contexto:** Con el crecimiento del frontend a 30+ rutas y 4000+ líneas en dashboard.js, surge la pregunta de si migrar a React.

**Decisión:** Mantener Vanilla JS. No migrar a React.

**Razón:**
- El equipo es de 1 persona que conoce JavaScript puro
- No hay necesidad de virtual DOM: las actualizaciones son por página completa (no componentes anidados reactivos)
- El patrón `loadData()` → `renderPage()` → `innerHTML` es simple y efectivo
- Las stores con observer pattern + localStorage cubren todo el estado necesario
- Migrar a React implicaría reescribir 100% del frontend sin beneficio claro

**Consecuencias:**
- Positivas: Sin deuda técnica de framework, build ultra-rápido (Vite), bundle mínimo
- Negativas: dashboard.js (4281 líneas) y dashboard-additions.js (911 líneas) son difíciles de mantener
- Mitigación: Refactorizar en módulos más pequeños (FASE 4 del plan)

---

#### ADR-016: Dual RAG — Estrategia de Migración

**Estado:** Aceptada (complementa ADR-005)
**Fecha:** 2026

**Contexto:** Existen dos implementaciones de RAG (NestJS local y Python ai-service), pero no está claro cuándo y cómo migrar de una a otra.

**Decisión:** Mantener ambas implementaciones. La variable `SCALE_MODE` controla cuál se usa. Estrategia:

1. **Fase 1 (actual):** Usar RAG local en NestJS (`SCALE_MODE=local`). Costo $0.
2. **Fase 2 (crecimiento):** Desplegar ai-service en Render (`SCALE_MODE=PRO`). Costo ~$7/mes.
3. **Fase 3 (escala):** Escalar ai-service horizontalmente con múltiples réplicas.

**Razón:**
- No pagar por un servicio que no se necesita al inicio
- Tener la opción PRO lista para cuando la app crezca
- El modo local es suficiente para consultas RAG básicas

**Consecuencias:**
- Positivas: Flexibilidad, cero costo inicial
- Negativas: Dos sistemas que mantener, posible divergencia de comportamiento
- ✅ **Nota:** El default en código es `SCALE_MODE='local'`. No requiere configuración adicional.

---

## 8. Mapa Exhaustivo de Funciones, Clases y Métodos

Este mapa cubre **todos los archivos del proyecto** con sus exportaciones principales. Sirve como índice para que un nuevo desarrollador encuentre rápidamente dónde está cada cosa.

### 8.1 Frontend

#### Entry Point

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `frontend/index.html` | - | HTML | Entry point, `<script type="module" src="/src/main.js">` |
| `frontend/vite.config.js` | `defineConfig` | Config | Proxy /api → backend:3000, build output |
| `frontend/src/main.js` | - | Module | Bootstrap: auth check, router init, socket connect |

#### Routing

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `router.js` | `router` | Object | Instancia del router |
| `router.js` | `router.register(path, config)` | Method | Registra ruta con render fn + public flag |
| `router.js` | `router.navigate(path, pushState)` | Method | Navegación programática |
| `router.js` | `router.init()` | Method | Inicia listener de popstate + click delegation |

#### Services

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `api.js` | `api` | Instance | Singleton de `ApiClient` |
| `api.js` | `class ApiClient` | Class | Fetch wrapper con auth + refresh |
| `api.js` | `api.get(path, params)` | Method | GET request |
| `api.js` | `api.post(path, data)` | Method | POST request |
| `api.js` | `api.put(path, data)` | Method | PUT request |
| `api.js` | `api.patch(path, data)` | Method | PATCH request |
| `api.js` | `api.delete(path)` | Method | DELETE request |
| `api.js` | `api.upload(path, formData)` | Method | Multipart upload |
| `api.js` | `api.download(path)` | Method | Download blob |
| `api.js` | `api.postFormData(path, formData)` | Method | Form data |
| `api.js` | `api.downloadAndSave(path, filename)` | Method | Save file locally |
| `api.js` | `api.getBlob(path)` | Method | GET blob |
| `socket.js` | `connectSocket()` | Function | Conecta Socket.IO |
| `socket.js` | `disconnectSocket()` | Function | Desconecta |
| `socket.js` | `joinCompanyRoom(companyId)` | Function | Join room |
| `socket.js` | `leaveCompanyRoom(companyId)` | Function | Leave room |
| `socket.js` | `onSocketEvent(event, callback)` | Function | Escucha evento |
| `socket.js` | `offSocketEvent(event, callback)` | Function | Deja de escuchar |
| `socket.js` | `emitSocketEvent(event, data)` | Function | Emite evento |

#### Stores

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `auth.store.js` | `login(data)` | Function | Guarda tokens + user, persiste, notifica |
| `auth.store.js` | `logout()` | Function | Limpia todo, redirect /login |
| `auth.store.js` | `setToken(token)` | Function | Actualiza access token |
| `auth.store.js` | `setUser(user)` | Function | Actualiza user |
| `auth.store.js` | `setCompany(company)` | Function | Guarda empresa |
| `auth.store.js` | `getToken()` | Function | Retorna access token |
| `auth.store.js` | `getRefreshToken()` | Function | Retorna refresh token |
| `auth.store.js` | `getUser()` | Function | Retorna user |
| `auth.store.js` | `getCompany()` | Function | Retorna company |
| `auth.store.js` | `isAuthenticated()` | Function | Boolean autenticado |
| `auth.store.js` | `hasRole(role)` | Function | Verifica rol |
| `auth.store.js` | `subscribe(callback)` | Function | Observer listener |
| `notifications.store.js` | `add(notification)` | Function | Agrega notificación |
| `notifications.store.js` | `markRead(id)` | Function | Marca como leída |
| `notifications.store.js` | `markAllRead()` | Function | Marca todas leídas |
| `notifications.store.js` | `remove(id)` | Function | Elimina notificación |
| `notifications.store.js` | `clear()` | Function | Limpia todas |
| `notifications.store.js` | `setNotifications(arr)` | Function | Reemplaza lista |
| `notifications.store.js` | `getUnreadCount()` | Function | Retorna conteo |
| `notifications.store.js` | `subscribe(callback)` | Function | Observer listener |

#### Componentes

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `Modal.js` | `createModal(config)` | Function | Crea modal apilable |
| `Modal.js` | `openModal(config)` | Function | Atajo para crear y abrir |
| `Modal.js` | `.open()` | Method | Abre modal |
| `Modal.js` | `.close()` | Method | Cierra modal |
| `Modal.js` | `.setContent(html)` | Method | Actualiza contenido |
| `Toast.js` | `Toast.show(msg, type, duration)` | Method | Muestra toast |
| `Toast.js` | `Toast.success(msg)` | Method | Toast verde |
| `Toast.js` | `Toast.error(msg)` | Method | Toast rojo |
| `Toast.js` | `Toast.warning(msg)` | Method | Toast amarillo |
| `Toast.js` | `Toast.info(msg)` | Method | Toast azul |
| `StepForm.js` | `createStepForm({steps, onComplete})` | Function | Wizard multi-step |
| `StepForm.js` | `.next()` | Method | Siguiente paso |
| `StepForm.js` | `.prev()` | Method | Paso anterior |
| `StepForm.js` | `.goTo(step)` | Method | Ir a paso específico |
| `SearchBar.js` | `createSearchBar({placeholder, onSearch, debounceMs})` | Function | Input de búsqueda |
| `SearchBar.js` | `.getValue()` | Method | Obtiene valor |
| `SearchBar.js` | `.clear()` | Method | Limpia input |
| `SearchBar.js` | `.focus()` | Method | Focus |
| `Pagination.js` | `createPagination({currentPage, totalPages, totalItems, onChange})` | Function | Paginación |
| `FileUpload.js` | `createFileUpload({accept, multiple, maxSize, onFiles})` | Function | Drag & drop upload |
| `NotificationBell.js` | `createNotificationBell()` | Function | Campana con badge |

#### Páginas / Secciones

| Archivo | Exportación | Propósito |
|---------|------------|-----------|
| `pages/auth.js` | `renderLoginPage()` | Login form |
| `pages/auth.js` | `renderRegisterPage()` | Register form |
| `pages/auth.js` | `handleAuthCallback()` | OAuth callback |
| `pages/dashboard.js` | `initDashboard()` | Inicializa dashboard |
| `pages/dashboard.js` | `navigateToSection(section)` | Navega a sección |
| `pages/dashboard.js` | `debounce(fn, ms)` | Utilidad |
| `pages/onboarding.js` | `renderOnboarding()` | Wizard empresa |
| `pages/sections/layout.js` | `renderSidebar()` | Sidebar menú |
| `pages/sections/layout.js` | `renderTopbar()` | Topbar con avatar |
| `pages/sections/home.js` | `loadHomeData()` | Carga stats |
| `pages/sections/home.js` | `renderHomePage()` | Renderiza inicio |
| `pages/sections/clients.js` | `loadClientsData()` | Carga clientes |
| `pages/sections/clients.js` | `renderClientsPage()` | Renderiza tabla |
| `pages/sections/pets.js` | `loadPetsData()` | Carga mascotas |
| `pages/sections/pets.js` | `renderPetsPage()` | Renderiza tabla |
| `pages/sections/medical-records.js` | `loadMedicalRecordsData()` | Carga consultas |
| `pages/sections/medical-records.js` | `renderMedicalRecordsPage()` | Renderiza consultas |
| `pages/sections/payments.js` | `loadPaymentsData()` | Carga pagos |
| `pages/sections/payments.js` | `renderPaymentsPage()` | Renderiza pagos |
| `pages/sections/supplies.js` | `loadSuppliesData()` | Carga insumos |
| `pages/sections/supplies.js` | `renderSuppliesPage()` | Renderiza insumos |
| `pages/sections/cash-register.js` | `loadCashRegisterData()` | Carga movimientos |
| `pages/sections/cash-register.js` | `renderCashRegisterPage()` | Renderiza caja |
| `pages/sections/ai-chat.js` | `loadAIChatData()` | Carga chat |
| `pages/sections/ai-chat.js` | `renderAIChatPage()` | Renderiza chat IA |
| `pages/sections/connections.js` | `loadConnectionsData()` | Carga conexiones |
| `pages/sections/connections.js` | `renderConnectionsPage()` | Renderiza conexiones |
| `pages/sections/settings.js` | `loadSettingsData()` | Carga config |
| `pages/sections/settings.js` | `renderSettingsPage()` | Renderiza settings |
| `pages/admin.js` | `renderAdminPage()` | Super admin panel |

#### Utilidades

| Archivo | Exportación | Propósito |
|---------|------------|-----------|
| `utils/validators.js` | `isRequired(value)` | Campo requerido |
| `utils/validators.js` | `isEmail(value)` | Email válido |
| `utils/validators.js` | `isCUIT(value)` | CUIT argentino válido |
| `utils/validators.js` | `isDNI(value)` | DNI argentino válido |
| `utils/validators.js` | `isPhone(value)` | Teléfono válido |
| `utils/validators.js` | `isPositiveNumber(value)` | Número positivo |
| `utils/validators.js` | `showFieldError(input, message)` | Muestra error en campo |
| `utils/validators.js` | `clearFieldError(input)` | Limpia error |
| `utils/formatters.js` | `formatCurrency(amount)` | Formatea moneda ($ARS) |
| `utils/formatters.js` | `formatDate(date)` | Formatea fecha (es-AR) |
| `utils/formatters.js` | `formatDateTime(datetime)` | Formatea fecha+hora |
| `utils/formatters.js` | `formatStatus(status)` | Traduce estado a español |
| `utils/formatters.js` | `formatPaymentMethod(method)` | Traduce método |
| `utils/formatters.js` | `formatSpecies(species)` | Traduce especie |

### 8.2 Backend — NestJS

#### Auth Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `auth/auth.controller.ts` | `AuthController` | Class | Rutas de autenticación |
| `auth/auth.controller.ts` | `register()` | Method | POST /auth/register |
| `auth/auth.controller.ts` | `login()` | Method | POST /auth/login |
| `auth/auth.controller.ts` | `refresh()` | Method | POST /auth/refresh |
| `auth/auth.controller.ts` | `getMe()` | Method | GET /auth/me |
| `auth/auth.controller.ts` | `googleAuth()` | Method | GET /auth/google |
| `auth/auth.controller.ts` | `googleAuthCallback()` | Method | GET /auth/google/callback |
| `auth/auth.service.ts` | `AuthService` | Class | Lógica de autenticación |
| `auth/auth.service.ts` | `register(dto)` | Method | Crea usuario + tokens |
| `auth/auth.service.ts` | `login(dto)` | Method | Verifica credenciales |
| `auth/auth.service.ts` | `refreshToken(token)` | Method | Refresca JWT |
| `auth/auth.service.ts` | `validateUser(id)` | Method | Valida usuario existe |
| `auth/jwt.strategy.ts` | `JwtStrategy` | Class | Passport JWT strategy |
| `auth/google.strategy.ts` | `GoogleStrategy` | Class | Passport Google OAuth |

#### Clients Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `clients/clients.controller.ts` | `ClientsController` | Class | Rutas CRUD clientes |
| `clients/clients.controller.ts` | `create(dto)` | Method | POST /clients |
| `clients/clients.controller.ts` | `findAll(query)` | Method | GET /clients (paginado) |
| `clients/clients.controller.ts` | `findOne(id)` | Method | GET /clients/:id |
| `clients/clients.controller.ts` | `update(id, dto)` | Method | PATCH /clients/:id |
| `clients/clients.controller.ts` | `remove(id)` | Method | DELETE /clients/:id (soft) |
| `clients/clients.controller.ts` | `findPets(id)` | Method | GET /clients/:id/pets |
| `clients/clients.controller.ts` | `findPayments(id)` | Method | GET /clients/:id/payments |
| `clients/clients.controller.ts` | `findDebts(id)` | Method | GET /clients/:id/debts |
| `clients/clients.service.ts` | `ClientsService` | Class | Lógica de negocio |
| `clients/clients.service.ts` | `create(dto, companyId)` | Method | Crea + sync RAG |
| `clients/clients.service.ts` | `findAll(companyId, query)` | Method | Lista paginada |
| `clients/clients.service.ts` | `findOne(id, companyId)` | Method | Busca por ID |
| `clients/clients.service.ts` | `update(id, dto, companyId)` | Method | Actualiza + sync RAG |
| `clients/clients.service.ts` | `remove(id, companyId)` | Method | Soft-delete + sync RAG |

#### Pets Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `pets/pets.controller.ts` | `PetsController` | Class | Rutas CRUD mascotas |
| `pets/pets.service.ts` | `PetsService` | Class | Lógica de negocio |
| `pets/pets.service.ts` | `create(dto, companyId)` | Method | Crea + sync RAG |
| `pets/pets.service.ts` | `findAll(companyId, query)` | Method | Lista paginada |
| `pets/pets.service.ts` | `findOne(id, companyId)` | Method | Busca por ID |
| `pets/pets.service.ts` | `update(id, dto, companyId)` | Method | Actualiza + sync RAG |
| `pets/pets.service.ts` | `remove(id, companyId)` | Method | Soft-delete + sync RAG |
| `pets/pets.service.ts` | `uploadPhoto(id, file, companyId)` | Method | Sube foto a Cloudinary |

#### MedicalRecords Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `medical-records/medical-records.controller.ts` | `MedicalRecordsController` | Class | Rutas CRUD consultas |
| `medical-records/medical-records.service.ts` | `MedicalRecordsService` | Class | Lógica de negocio |
| `medical-records/medical-records.service.ts` | `create(dto, companyId)` | Method | Transacción atómica (record + procedures + prescriptions + payment + stock + cash + RAG) |

#### Payments Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `payments/payments.controller.ts` | `PaymentsController` | Class | Rutas CRUD pagos |
| `payments/payments.service.ts` | `PaymentsService` | Class | Lógica de negocio |
| `payments/payments.service.ts` | `generateCheckout(id, companyId)` | Method | Crea preferencia MP |

#### Debts Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `debts/debts.controller.ts` | `DebtsController` | Class | Rutas CRUD deudas |
| `debts/debts.service.ts` | `DebtsService` | Class | Lógica de negocio |
| `debts/debts.service.ts` | `pay(id, dto, companyId)` | Method | Procesa pago de deuda |
| `debts/debts.service.ts` | `calculateDebtAmount(debt)` | Method | Calcula monto con interés |
| `debts/debts.service.ts` | `processAlerts()` | Method | Cron: alertas diarias |

#### Supports Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `supplies/supplies.controller.ts` | `SuppliesController` | Class | Rutas CRUD insumos |
| `supplies/supplies.service.ts` | `SuppliesService` | Class | Lógica de negocio |
| `supplies/supplies.service.ts` | `importExcel(file, companyId)` | Method | Importa Excel de insumos |
| `supplies/supplies.service.ts` | `exportExcel(companyId)` | Method | Exporta Excel de insumos |
| `supplies/supplies.service.ts` | `getLowStock(companyId)` | Method | Insumos con stock bajo |

#### CashRegister Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `cash-register/cash-register.controller.ts` | `CashRegisterController` | Class | Rutas caja |
| `cash-register/cash-register.service.ts` | `CashRegisterService` | Class | Lógica de negocio |
| `cash-register/cash-register.service.ts` | `createFromPayment(paymentId, companyId)` | Method | Crea movimiento desde pago |

#### Subscriptions Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `subscriptions/subscriptions.controller.ts` | `SubscriptionsController` | Class | Rutas suscripciones |
| `subscriptions/subscriptions.service.ts` | `SubscriptionsService` | Class | Lógica de negocio |
| `subscriptions/subscriptions.service.ts` | `createCheckout(plan, companyId)` | Method | Crea preferencia MP subscripción |
| `subscriptions/subscriptions.service.ts` | `handleWebhook(event)` | Method | Procesa webhook MP |
| `subscriptions/subscriptions.service.ts` | `checkExpirations()` | Method | Cron: expira suscripciones vencidas |

#### Mercadopago Module

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `mercadopago/mercadopago.controller.ts` | `MercadopagoController` | Class | Rutas MP |
| `mercadopago/mercadopago.service.ts` | `MercadopagoService` | Class | Lógica de integración |
| `mercadopago/mercadopago.service.ts` | `createPreference(dto)` | Method | Crea preferencia checkout |
| `mercadopago/mercadopago.service.ts` | `createQR(dto)` | Method | Crea QR de pago |
| `mercadopago/mercadopago.service.ts` | `handleWebhook(event)` | Method | Procesa webhook de pago |
| `mercadopago/mercadopago.service.ts` | `getPaymentStatus(id)` | Method | Consulta estado en MP |

#### WebSocket / Events

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `events/events.gateway.ts` | `EventsGateway` | Class | WebSocket gateway |
| `events/events.gateway.ts` | `handleConnection(client)` | Method | On connect: verifica JWT, join rooms |
| `events/events.gateway.ts` | `emitToCompany(companyId, event, data)` | Method | Emite a room de empresa |
| `events/events.gateway.ts` | `emitToUser(userId, event, data)` | Method | Emite a room de usuario |

#### Cron

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `cron/cron.service.ts` | `CronService` | Class | Tareas programadas |
| `cron/cron.service.ts` | `handleDebtAlerts()` | Method | 8AM: alertas de deudas |
| `cron/cron.service.ts` | `handleSubscriptionExpiry()` | Method | 10AM: expira suscripciones |
| `cron/cron.service.ts` | `handleStockAlerts()` | Method | 2PM: alertas stock bajo |
| `cron/cron.service.ts` | `handleRefreshTokenCleanup()` | Method | 4PM: limpia tokens expirados |

#### Servicios Compartidos (Globales)

| Archivo | Exportación | Tipo | Propósito |
|---------|------------|------|-----------|
| `prisma/prisma.service.ts` | `PrismaService` | Class | Singleton PrismaClient |
| `prisma/prisma.service.ts` | `onModuleInit()` | Method | Conecta a PostgreSQL |
| `prisma/prisma.service.ts` | `onModuleDestroy()` | Method | Desconecta |
| `redis/redis.service.ts` | `RedisService` | Class | Singleton Redis client |
| `redis/redis.service.ts` | `get(key)` | Method | Obtiene valor |
| `redis/redis.service.ts` | `set(key, value, ttl?)` | Method | Setea valor con TTL |
| `redis/redis.service.ts` | `del(key)` | Method | Elimina clave |
| `redis/redis.service.ts` | `getOrSet(key, fn, ttl)` | Method | Cache-aside pattern |

### 8.3 Base de Datos

| Tabla | Columnas Clave | Índices | Propósito |
|-------|---------------|---------|-----------|
| `Company` | `id, name, slug (UK), cuit (UK), isBlocked` | slug, cuit | Clínica veterinaria (tenant) |
| `CompanyConfig` | `id, companyId (FK), currency, mp*` | companyId (UQ) | Config por empresa |
| `User` | `id, email (UK), passwordHash, role, companyId` | email, googleId | Usuarios del sistema |
| `RefreshToken` | `id, token (UK), userId, expiresAt` | token, userId | JWT refresh tokens |
| `Subscription` | `id, companyId (FK), plan, status, expiresAt` | companyId (UQ) | Plan de suscripción |
| `Client` | `id, companyId, name, dni, email, isDeleted` | companyId, dni | Dueño de mascota |
| `Pet` | `id, companyId, clientId, name, species, isDeleted` | companyId, clientId | Mascota |
| `PetPhoto` | `id, petId, cloudinaryUrl, isPrimary` | petId | Foto de mascota |
| `MedicalRecord` | `id, companyId, petId, date, diagnosis, isDeleted` | companyId, petId | Consulta veterinaria |
| `Procedure` | `id, medicalRecordId, name, quantity, supplyId` | medicalRecordId | Procedimiento |
| `Prescription` | `id, medicalRecordId, medicineName, dose, soldInClinic` | medicalRecordId | Receta |
| `PriceItem` | `id, companyId, name, category, price, isActive` | companyId | Catálogo de precios |
| `Payment` | `id, companyId, clientId, totalAmount, status, method, isDeleted` | companyId, clientId | Pago/Factura |
| `PaymentItem` | `id, paymentId, description, quantity, unitPrice` | paymentId | Línea de pago |
| `Debt` | `id, companyId, clientId, amount, status, dueDate, isDeleted` | companyId, clientId | Deuda |
| `Supply` | `id, companyId, name, quantity, minQuantity, salePrice, isDeleted` | companyId | Insumo/Stock |
| `SupplyPurchase` | `id, supplyId, quantity, unitCost, supplier` | supplyId | Compra de insumos |
| `Document` | `id, companyId, type, cloudinaryUrl, relatedEntityId` | companyId | Documento/PDF |
| `Notification` | `id, companyId, userId, type, title, isRead` | companyId, userId | Notificación in-app |
| `CashMovement` | `id, companyId, type (INCOME/EXPENSE), amount, date, paymentId` | companyId | Movimiento de caja |
| `GlobalConfig` | `key (PK), value, description` | key (PK) | Config global del sistema |
| `langchain_vectors` | `id, content, metadata (JSONB), embedding (vector(768)), company_id` | company_id, ivfflat embedding | Vectores RAG (raw SQL) |

### 8.4 Frontend — CSS

| Archivo | Sección | Propósito |
|---------|---------|-----------|
| `main.css` | `:root` | CSS custom properties (colores, fuentes, spacing) |
| `main.css` | `.btn`, `.btn-primary`, etc. | Sistema de botones (6 variantes + sizes) |
| `main.css` | `.form-input`, `.form-group`, `.form-error` | Formularios |
| `main.css` | `.data-table` | Tablas de datos |
| `main.css` | `.modal-*` | Modales (overlay, content, header, footer) |
| `main.css` | `.toast-*` | Toast notifications (success, error, warning, info) |
| `main.css` | `.card`, `.stats-grid`, `.stat-card` | Dashboard stats |
| `main.css` | `.sidebar`, `.topbar`, `.dashboard-layout` | Layout dashboard |
| `main.css` | `.chat-container`, `.chat-message` | Chat IA |
| `main.css` | `.pagination` | Paginación |
| `main.css` | `.search-bar` | Barra de búsqueda |
| `main.css` | `.file-upload` | Drag & drop upload |
| `main.css` | `.step-form-*` | Wizard multi-step |
| `main.css` | `.empty-state` | Estado vacío |
| `main.css` | `.badge` | Badges para estados |
| `main.css` | `.settings-nav`, `.settings-tab` | Navegación settings |
| `main.css` | Responsive (`@media < 1024px`) | Sidebar colapsable |

---

## 9. Guía de Onboarding

### 9.1 Setup Local (5 pasos)

#### Prerrequisitos

| Herramienta | Versión | Para qué |
|-------------|---------|----------|
| Node.js | 20.x | Backend NestJS |
| npm | 10+ | Paquetes |
| PostgreSQL | 15+ | Base de datos |
| Redis | 7+ | Cache + sesiones |
| Python | 3.11+ | Solo si usas ai-service |

#### Paso 1: Clonar e instalar dependencias

```bash
git clone <repo-url>
cd veterinaria

# Backend
cd backend
npm install
cp .env.example .env  # Configurar variables

# Frontend
cd ../frontend
npm install

# ai-service (opcional, solo para modo PRO)
cd ../ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Paso 2: Configurar variables de entorno

Archivo `backend/.env`:

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret

# AI - Modo Local (recomendado para desarrollo)
SCALE_MODE=local
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key

# MercadoPago (opcional para desarrollo)
MP_ACCESS_TOKEN=your-mp-token
```

#### Paso 3: Inicializar base de datos

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

Esto aplica las migraciones y crea las 22 tablas + el índice pgvector.

#### Paso 4: Iniciar servidores

```bash
# Terminal 1: Backend NestJS
cd backend
npm run start:dev

# Terminal 2: Frontend Vite
cd frontend
npm run dev

# Terminal 3: ai-service (opcional, solo modo PRO)
cd ai-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

#### Paso 5: Verificar

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- ai-service: `http://localhost:8000/health`

### 9.2 Cómo Correr Tests

**Backend (Vitest):**
```bash
cd backend
npm run test           # Unit tests
npm run test:cov       # Coverage
npm run test:e2e       # E2E tests
```

**Frontend (Playwright):**
```bash
cd frontend
npm run test:e2e       # E2E en navegador
npx playwright show-report  # Ver reporte
```

### 9.3 Debugging

#### Log Levels
```typescript
// NestJS: configurar en main.ts
Logger.log('info message');
Logger.debug('debug message');  // NEST_DEBUG=true
Logger.warn('warning');
Logger.error('error', trace);
```

#### Node Inspector
```bash
cd backend
node --inspect dist/main.js
# Abrir chrome://inspect en el navegador
```

#### WebSocket Events
```javascript
// En frontend, para debuggear eventos Socket.IO:
socket.onAny((event, ...args) => {
  console.log(`[WS] ${event}`, args);
});
```

#### Prisma Studio
```bash
cd backend
npx prisma studio
# Abre http://localhost:5555 para ver/editar datos
```

### 9.4 Cómo Escalar

#### Escalado Horizontal (más usuarios concurrentes)

```
Cuando la app crezca:

1. Múltiples réplicas NestJS detrás de un load balancer
   → Requiere: sticky sessions desactivadas
   → WebSocket: usar Redis adapter para Socket.IO
   → BullMQ: ya usa Redis, no requiere cambios

2. Base de datos:
   → PostgreSQL: read replicas para consultas
   → pgvector: índice IVFFLAT ya configurado (lists=100)

3. Cache:
   → Redis: cluster mode si es necesario
```

#### Escalado Vertical (más funcionalidad IA)

```
Cuando se necesiten respuestas más inteligentes:

1. Configurar SCALE_MODE=PRO en .env
2. Desplegar ai-service en Render.com
3. Configurar AI_SERVICE_URL en el backend
4. Opcional: agregar API Key de OpenAI para GPT-4o

El ai-service tiene:
- LangChain Agent con 6 tools que consultan DB directo
- Memoria conversacional en Redis
- ChromaDB con chunking inteligente
- Transcripción de audio con Whisper
```

### 9.5 Patrones a Seguir para Contribuir

#### Cómo agregar un nuevo módulo backend

1. Crear carpeta en `backend/src/nuevo-modulo/`
2. Crear `nuevo-modulo.module.ts`, `.controller.ts`, `.service.ts`, `dto/`
3. Importar en `app.module.ts`
4. Agregar ruta en el controller con prefijo `api/v1/...`
5. Si la entidad necesita RAG: inyectar `LocalRagService` y llamar `upsertEmbedding` en create/update/delete

#### Cómo agregar una nueva sección frontend

1. Crear archivo en `frontend/src/pages/sections/nueva-seccion.js`
2. Exportar `loadNuevaSeccionData()` y `renderNuevaSeccionPage()`
3. Registrar ruta en `frontend/src/main.js` con `router.register()`
4. Agregar entrada en el sidebar en `layout.js`
5. Seguir el patrón CRUD: page-header + data-table + pagination + modales

#### Convenciones de Código

| Aspecto | Convención |
|---------|-----------|
| **Idioma** | Código en inglés (variables, funciones), UI en español argentino |
| **Nombres backend** | `camelCase` para métodos/variables, `PascalCase` para clases/DTOs |

## Estándares de Arquitectura y Calidad

### Manejo de DTOs
- **Entrada:** Todo método de controlador debe usar un DTO validado con `class-validator`.
- **Salida:** Los controladores principales deben usar decoradores `@ApiResponse({ type: XxxResponseDto })` para mantener el contrato Swagger actualizado. (Ver `common/dto/response.dto.ts`).

### Dependencias entre Módulos
Se prohíbe la creación de nuevas dependencias circulares. El uso de `forwardRef` está depreciado y solo se mantiene por compatibilidad con la v1.0. Para nuevas integraciones entre módulos, utilice el patrón de **Eventos**.
| **Nombres frontend** | `camelCase` para funciones, `kebab-case` para archivos |
| **Rutas API** | Plural: `/api/v1/clients`, `/api/v1/medical-records` |
| **Soft-delete** | Siempre filtrar `isDeleted: false` en todas las queries |
| **Multi-tenant** | Siempre filtrar por `companyId` del token, nunca confiar en input del usuario |
| **Transacciones** | Usar `this.prisma.$transaction()` para operaciones que modifican múltiples tablas |
| **Errores** | Lanzar excepciones NestJS (`NotFoundException`, `BadRequestException`, etc.) |
| **RAG sync** | Llamar `this.rag.upsertEmbedding()` después de cada create/update relevante |

### 9.6 Troubleshooting Común

| Problema | Causa Probable | Solución |
|----------|---------------|----------|
| `401 Unauthorized` en todas las peticiones | Token expirado o inválido | Hacer login de nuevo |
| `403 SUBSCRIPTION_EXPIRED` | Suscripción vencida | Ir a /settings/subscription |
| `403 ONBOARDING_REQUIRED` | Empresa no creada | Completar onboarding |
| Chat IA responde "No tengo información" | RAG no sincronizado | Ir a Settings > IA > Sincronizar |
| Chat IA no funciona | SCALE_MODE=PRO pero ai-service no corre | Cambiar a SCALE_MODE=local o iniciar ai-service |
| WebSocket no conecta | Puerto/firewall | Verificar que backend esté en puerto 3000 |
| `prisma:error` | Migraciones no aplicadas | `npx prisma migrate dev` |
| `ECONNREFUSED :6379` | Redis no corriendo | `redis-server` o `docker run redis` |
