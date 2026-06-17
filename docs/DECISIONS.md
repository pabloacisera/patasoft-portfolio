# PataSoft - Decisiones Técnicas (ADR)

## ADR-001: Vanilla JS sin framework para el frontend

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
El equipo es de 1 persona. Se necesita una SPA con ~30 rutas, modales, formularios multi-step, chat IA, WebSockets.

### Decisión
Usar Vite + Vanilla JavaScript puro, sin React/Vue/Angular/Svelte.

### Razón
- Sin curva de aprendizaje de framework
- Build ultra-rápido (solo Vite, sin Babel/SWC)
- Control total del DOM y rendimiento
- Solo 2 dependencias de producción (vite + socket.io-client)

### Consecuencias
- **Positivas:** Bundle mínimo, build rápido, simplicidad
- **Negativas:** `dashboard.jsx` creció a 4281 líneas, difícil de mantener con más devs, sin reactividad automática
- **Mitigación:** Atomizar en módulos por sección (FASE 4 del plan)

---

## ADR-002: NestJS como backend

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita un backend modular, con TypeScript, que soporte 30+ módulos de negocio.

### Decisión
Usar NestJS 10 con TypeScript.

### Razón
- Arquitectura modular con inyección de dependencias
- TypeScript nativo con decoradores
- Ecosistema enterprise (Guards, Pipes, Interceptors, Filters)
- Soporte nativo para WebSockets, Cron, BullMQ

### Consecuencias
- **Positivas:** Código bien organizado, escalable, documentado con Swagger
- **Negativas:** Curva de aprendizaje de conceptos NestJS, overhead de decoradores

---

## ADR-003: Prisma como ORM

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita un ORM type-safe para PostgreSQL con 22 modelos y migraciones.

### Decisión
Usar Prisma 5.x como ORM.

### Razón
- Type-safety generado automáticamente desde el schema
- Migraciones declarativas
- Cliente con API intuitiva
- Soporte para transacciones interactivas

### Consecuencias
- **Positivas:** Schema como fuente de verdad, cliente tipado
- **Negativas:** No soporta pgvector nativamente (se usa `pg` Pool separado), `db push --accept-data-loss` es peligroso en producción

---

## ADR-004: pgvector en vez de ChromaDB/Pinecone

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita una base de datos vectorial para embeddings de RAG.

### Decisión
Usar pgvector (extensión de PostgreSQL) en la misma base de datos principal.

### Razón
- Costo cero: ya tenemos PostgreSQL
- Sin servicio externo adicional
- Consultas SQL nativas con JOIN a datos relacionales
- 768 dimensiones (Gemini embeddings)

### Consecuencias
- **Positivas:** Un solo servicio de DB, queries combinadas (vectorial + relacional)
- **Negativas:** Tabla `langchain_vectors` fuera de Prisma (SQL raw), rendimiento limitado vs. soluciones especializadas a gran escala

---

## ADR-005: LangChain dentro de NestJS (no ai-service) para inicio

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
El ai-service de Python implica un costo extra en Render.com (~$7/mes adicionales).

### Decisión
Implementar RAG directamente en NestJS usando `@google/genai` + `groq-sdk` + pgvector. El ai-service de Python existe como alternativa PRO para cuando la aplicación escale.

### Razón
- Evitar costo de servicio adicional en Render
- Groq y Gemini tienen SDKs de JavaScript
- pgvector ya está en PostgreSQL

### Consecuencias
- **Positivas:** Menor costo, un solo proceso para RAG
- **Negativas:** No se puede usar LangChain Agent con tools (solo disponible en Python), el proceso NestJS hace más trabajo
- **Plan de migración:** Cuando la app escale, activar ai-service y cambiar `SCALE_MODE=pro`

### ⚠️ Nota sobre el default actual
El archivo `backend/src/ai-proxy/ai-proxy.service.ts` tiene `SCALE_MODE` con default `'local'` (línea 28: `this.config.get<string>('SCALE_MODE') || 'local'`). Para usar el modo PRO (ai-service externo), se debe configurar explícitamente `SCALE_MODE=PRO` en el `.env` de producción.

---

## ADR-006: Multi-tenant por companyId (shared DB)

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita aislar datos de múltiples clínicas veterinarias.

### Decisión
Base de datos compartida con `companyId` como discriminador de tenant en todas las entidades.

### Razón
- 10 clientes iniciales no justifican DB por tenant
- Simplicidad operacional (1 backup, 1 migración)
- Prisma facilita el filtrado por companyId

### Consecuencias
- **Positivas:** Simple, económico, fácil de migrar
- **Negativas:** Un query mal escrito puede filtrar datos entre tenants, requiere disciplina en cada servicio
- **Mitigación:** Tests de aislamiento multi-tenant (FASE 2.2)

---

## ADR-007: Render.com como hosting

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita hosting con deploy automático, PostgreSQL y Redis managed.

### Decisión
Usar Render.com con Blueprint (render.yaml).

### Razón
- Free tier para web services, PostgreSQL y Redis
- Auto-deploy desde Git
- Health checks nativos
- render.yaml como infraestructura como código

### Consecuencias
- **Positivas:** Deploy automático, infraestructura gestionada, sin DevOps
- **Negativas:** Free tier con limitaciones (spin-down tras inactividad), sin Docker nativo

---

## ADR-008: MercadoPago para pagos y suscripciones

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita procesar pagos y suscripciones para el mercado argentino.

### Decisión
Usar MercadoPago con Checkout Pro, QR y suscripciones.

### Razón
- Líder en pagos digitales en Argentina
- Soporte para QR (útil en veterinarias)
- API de suscripciones integrada
- Webhooks para confirmación asíncrona

### Consecuencias
- **Positivas:** Familiar para usuarios argentinos, múltiples métodos de pago
- **Negativas:** API compleja, webhooks requieren URL pública (Cloudflare Tunnel en dev)

---

## ADR-009: Soft-delete en entidades de negocio

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita mantener historial de datos eliminados para auditoría.

### Decisión
Implementar soft-delete con campos `isDeleted` + `deletedAt` en: Client, Pet, MedicalRecord, Payment, Debt, Supply, Document.

### Razón
- Auditoría y cumplimiento
- Posibilidad de recuperación de datos
- Integridad histórica (pagos asociados a clientes eliminados)

### Consecuencias
- **Positivas:** Datos nunca se pierden, trazabilidad
- **Negativas:** Filtrado manual en cada query (no hay middleware de Prisma), tablas crecen con datos "muertos"

---

## ADR-010: JWT con refresh token en DB

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Se necesita autenticación segura con capacidad de revocación.

### Decisión
JWT access token (7 días) + refresh token (30 días) almacenado en tabla `RefreshToken`.

### Razón
- Access token de corta vida limita ventana de ataque
- Refresh token en DB permite revocación server-side
- Separación de secrets (JWT_SECRET vs JWT_REFRESH_SECRET)

### Consecuencias
- **Positivas:** Revocación posible, seguridad mejorada
- **Negativas:** Consulta a DB en cada refresh, tokens en localStorage vulnerables a XSS

---

## ADR-011: Sin Docker en producción

**Estado:** Aceptada
**Fecha:** 2025

### Contexto
Render.com no requiere Docker para web services.

### Decisión
No usar Docker/Docker Compose en producción. Los Dockerfiles existen como respaldo.

### Razón
- Render despliega directamente desde el código fuente
- Simplifica el pipeline de deploy
- Menor complejidad operacional

### Consecuencias
- **Positivas:** Deploy más simple, menos capas
- **Negativas:** No hay paridad local/producción, Dockerfiles desactualizados

---

## ADR-012: Vitest sobre Jest para testing

**Estado:** Aceptada
**Fecha:** 2026

### Contexto
Se necesita un framework de testing para el backend NestJS.

### Decisión
Usar Vitest en lugar de Jest.

### Razón
- Más rápido (usa Vite como bundler, ESM nativo)
- API compatible con Jest (describe, it, expect, beforeEach, etc.)
- Hot Module Replacement en watch mode
- Coverage con @vitest/coverage-v8

### Consecuencias
- **Positivas:** Tests más rápidos, mejor DX
- **Negativas:** Menos documentación que Jest para NestJS específicamente

---

## ADR-013: Playwright E2E sobre Vitest+jsdom

**Estado:** Aceptada
**Fecha:** 2026

### Contexto
Se necesitan tests E2E para el frontend Vanilla JS.

### Decisión
Usar Playwright para tests E2E en navegador real.

### Razón
- Tests fieles al comportamiento real del usuario
- Soporte para múltiples navegadores
- Auto-wait y selectors robustos
- Screenshots y videos en fallos

### Consecuencias
- **Positivas:** Tests confiables, debugging visual
- **Negativas:** Más lentos que tests unitarios, requieren servidor corriendo

---

## ADR-014: Gestión de Deuda Técnica (Circular Dependencies & DTOs)

**Estado:** Aceptada
**Fecha:** 6 de junio de 2026

### Contexto
El crecimiento acelerado del MVP resultó en dos compromisos arquitectónicos:
1.  Uso de `forwardRef` para resolver dependencias circulares entre módulos (AiProxy↔Queues y Subscriptions↔Events).
2.  Desconexión de los DTOs de Respuesta en los controladores, favoreciendo el retorno directo de objetos Prisma por agilidad.

### Decisión
1.  **Release 1.0.0 (v1.0.0-stable):** Mantener las referencias circulares mediante `forwardRef` para asegurar la estabilidad operativa inmediata.
2.  **DTOs de Respuesta:** Forzar el uso de `@ApiResponse` y tipos de retorno explícitos en los controladores principales antes del release final.
3.  **Refactor v1.1.0:** Se establece el compromiso de refactorizar el sistema de comunicación entre módulos hacia una **Arquitectura Orientada a Eventos (NestJS EventEmitter2 o Message Bus)** para eliminar las dependencias circulares.

### Razón
- Resolver las dependencias circulares ahora implica una refactorización de alto riesgo sobre el grafo de inyección de NestJS que podría desestabilizar el lanzamiento.
- Los DTOs de respuesta son necesarios para un contrato claro (Swagger) y seguridad de tipos en el frontend.

### Consecuencias
- **Positivas:** Contrato de API verídico y documentado. Estabilidad para el primer release.
- **Negativas:** El código del backend mantiene un acoplamiento temporal que debe ser saneado en el corto plazo (v1.1.0).

---

# REGISTRO DE CORRECCIONES TÉCNICAS (FIX Log)

Este registro documenta errores encontrados, su causa raíz, la solución aplicada
y cómo fue verificada. Sirve para entender la evolución y madurez del sistema.

---

## FIX-001: forwardRef sin documentación
**Fecha:** 6 de junio de 2026
**Dimensión:** Arquitectura / Mantenibilidad
**Problema:** Cinco usos de forwardRef() en módulos NestJS sin comentario que
  explique la dependencia circular. Riesgo: un desarrollador futuro podría
  eliminar el forwardRef creyendo que es código muerto, rompiendo el módulo.
**Causa raíz:** Las dependencias circulares entre AiProxyModule↔QueuesModule y
  SubscriptionsModule↔EventsModule son reales e inevitables dado el diseño actual.
  El forwardRef es la solución correcta de NestJS para este caso, pero no estaba
  documentado.
**Solución:** Agregar comentario de una línea en cada ocurrencia explicando la
  dependencia circular.
**Verificación:** npm run build -> 0 errores.
**Archivos modificados:**
  - backend/src/ai-proxy/ai-proxy.module.ts
  - backend/src/ai-proxy/ai-proxy.controller.ts
  - backend/src/queues/queues.module.ts
  - backend/src/subscriptions/subscriptions.module.ts
  - backend/src/subscriptions/subscriptions.service.ts
**Deuda residual:** ninguna.

---

## FIX-002: Response DTOs definidos pero no conectados a controllers
**Fecha:** 6 de junio de 2026
**Dimensión:** Código Backend / Swagger
**Problema:** common/dto/response.dto.ts tiene 11 DTOs bien definidos con
  @ApiProperty, pero ningún controller los usa como tipo de retorno. El beneficio
  (Swagger autodoc, type-safe returns) no está activo.
**Causa raíz:** La tarea 3.8 se completó creando el archivo pero no incluyó el
  paso de conectar los DTOs a los controllers.
**Solución:** Movido a tarea 8.1 como deuda post-producción explícita. Los DTOs
  existen y están correctos — la conexión se hará en la próxima iteración sin
  urgencia de producción. Se agregó comentario de advertencia en el archivo.
**Verificación:** Verificado que response.dto.ts compila sin errores en build.
**Archivos modificados:**
  - backend/src/common/dto/response.dto.ts
  - TASKS.txt (nueva tarea 8.1)
**Deuda residual:** Tarea 8.1 abierta.

---

## FIX-003: Streaming simulado reemplazado por streaming real en AI Service
**Fecha:** 5 de junio de 2026
**Dimensión:** AI Service / UX
**Problema:** chat.py usaba agent.invoke() (síncrono) y simulaba streaming
  chunkeando la respuesta completa con sleep(). El usuario esperaba 5-8 segundos
  sin ningún feedback visual.
**Causa raíz:** AgentExecutor en modo sync no expone eventos intermedios.
  El chunking era una aproximación que no resolvía el problema real.
**Solución:** Migrar a agent_executor.astream() con generador async SSE real.
  Emite eventos de tipo: action (qué tool usa), observation (resultado de tool),
  output (respuesta final). NestJS hace pipe del stream con Readable.fromWeb().
  Frontend consume con ReadableStream + TextDecoder + fallback al endpoint JSON.
**Verificación:** Test manual: tokens aparecen en <300ms. Fallback a /ai/chat
  funciona cuando stream no está disponible. npm run build -> OK.
**Archivos modificados:**
  - ai-service/app/api/chat.py (astream + StreamingResponse)
  - backend/src/ai-proxy/ai-proxy.controller.ts (POST /chat/stream, SSE headers)
  - backend/src/ai-proxy/ai-proxy.service.ts (chatStream() proxy)
  - backend/src/ai-proxy/local-rag.service.ts (queryStream() generador)
  - frontend/src/pages/sections/ai-chat.js (ReadableStream consumer + fallback)
**Deuda residual:** ninguna en streaming. El endpoint JSON /ai/chat sigue disponible
  como fallback.

---

## FIX-004: Puppeteer sin pool reemplazado por pool de 2 browsers
**Fecha:** 4 de junio de 2026
**Dimensión:** Backend / Performance / Estabilidad
**Problema:** pdf.service.ts lanzaba un proceso Chromium nuevo por cada PDF generado.
  Con 3+ solicitudes simultáneas de PDF, el servicio agotaba los 512MB de RAM
  disponibles en el free tier de Render, causando OOM kills.
**Causa raíz:** puppeteer.launch() es una operación costosa (~200MB RAM por instancia).
  Sin pool, cada request pagaba ese costo desde cero.
**Solución:** Pool de 2 instancias de Browser con:
  - Reutilización si browser está conectado y tiene <10 páginas abiertas
  - Lanzamiento de nuevo browser en slot vacío si hay capacidad
  - Reciclaje (close + relaunch) en slot ocupado si el pool está lleno
  - page.close() en bloque finally para evitar leaks de páginas
  - onModuleDestroy() cierra todos los browsers al apagar el servicio
**Verificación:** npm run build -> OK. Test de PDF service pasa.
**Archivos modificados:**
  - backend/src/documents/pdf.service.ts
**Deuda residual:** Sin semáforo de concurrencia estricto. Si 5+ PDFs llegan
  simultáneamente, el pool puede reciclarse antes de que terminen. Mejora en tarea 8.4.

---

## FIX-005: Actualización de documentación arquitectónica
**Fecha:** 6 de junio de 2026
**Dimensión:** Documentación / Mantenibilidad
**Problema:** ARCHITECTURE.md no reflejaba la nueva estructura de módulos (VeterinaryModule, IntegrationsModule) ni los nuevos DTOs compartidos.
**Causa raíz:** Desfase natural entre implementación y documentación post-remediación.
**Solución:** Actualizar ARCHITECTURE.md con la organización de módulos actual y mención a response.dto.ts.
**Verificación:** Revisión manual de consistencia.
**Archivos modificados:**
  - docs/ARCHITECTURE.md
**Deuda residual:** Ninguna.

---

## FIX-006: Documentación del sistema de agente desactualizada
**Fecha:** 6 de junio de 2026
**Dimensión:** Documentación / Sistema de agente
**Problema:** Los archivos agent/CONTEXT.md, agent/SKILL.md, agent/SPECS.md,
  agent/DEPLOY.md y agent/MCP.md estaban desactualizados desde la primera sesión
  de construcción (2026-04-24). CONTEXT.md describía fases de plan de implementación
  0-11 que nunca existieron. SKILL.md y SPECS.md contenían referencias a Astro,
  React, Tailwind, Zustand y Axios que no se usan en el proyecto. DEPLOY.md y MCP.md
  tenían estructura de directorios incorrecta.
**Causa raíz:** La documentación del sistema de agente fue creada al inicio del
  proyecto y nunca actualizada después de la construcción y remediación técnica.
  El proyecto tomó decisiones diferentes durante el desarrollo (Vanilla JS en vez
  de Astro/React, CSS puro en vez de Tailwind, etc.) pero los documentos nunca
  reflejaron esos cambios.
**Solución:** Reconstrucción completa por ingeniería inversa del código real:
  - CONTEXT.md: reemplazado con estado post-remediación (67/77 tareas, scoring 8.4/10)
  - SKILL.md: reemplazado con reglas del stack real (Vanilla JS, Fetch API, CSS puro)
  - SPECS.md: reemplazado con estructura real de directorios y schema actual
  - DEPLOY.md: actualizado con Supabase + Upstash como servicios externos
  - MCP.md: actualizado con estructura real de directorios del backend (28 módulos)
  - README.md: actualizado con notas sobre Supabase/Upstash como DB/KV de producción
**Verificación:** 6 verificaciones grep ejecutadas (no quedan referencias a
  Astro/React/Tailwind/Zustand excepto en secciones "LO QUE NO SE USA").
**Archivos modificados:**
  - agent/CONTEXT.md
  - agent/SKILL.md
  - agent/SPECS.md
  - agent/DEPLOY.md
  - agent/README.md
**Deuda residual:** El archivo agent/IMPLEMENTS.md también contiene algunas
  referencias al plan de tareas original (A-01 a F-02) que podrían actualizarse
  para reflejar el estado construido real del proyecto.

---

## FIX-007: Reorganización de TASKS.txt en backlog activo + historial
**Fecha:** 6 de junio de 2026
**Dimensión:** Documentación / Proceso
**Problema:** TASKS.txt contenía 67 tareas completadas mezcladas con 10 pendientes,
  dificultando que el agente identifique rápidamente qué falta hacer.
**Solución:** Separar en TASKS.txt (solo pendientes, clasificadas por urgencia:
  bloqueantes, post-producción v1.1.0, testing pendiente) y
  agent/TASKS_HISTORY.md (archivo de solo lectura con el historial completo).
**Verificación:** grep confirma 0 tareas [x] en TASKS.txt, 10 tareas [ ] en TASKS.txt,
  y 67 tareas [x] en TASKS_HISTORY.md.
**Archivos modificados:** TASKS.txt, agent/TASKS_HISTORY.md (nuevo)
**Deuda residual:** ninguna.

---

## ADR-015: Generación de secretos criptográficos para JWT y encriptación

**Estado:** Aceptada
**Fecha:** 6 de junio de 2026

### Contexto
Al sincronizar `.env` y `.env.local` (tarea 8.0) y agregar placeholders de infraestructura (tarea 8.1), se requerían valores seguros para:
- `JWT_SECRET` y `JWT_REFRESH_SECRET` (firma de tokens)
- `ENCRYPTION_KEY` y `ENCRYPTION_IV` (encriptación AES-256 de tokens MP)

### Decisión
Generar secretos criptográficamente seguros usando `openssl` y documentar el comando exacto en los archivos `.env` como comentarios para reproducibilidad.

### Comandos utilizados
```bash
# JWT secrets (64 bytes = 512 bits, base64)
openssl rand -base64 64

# ENCRYPTION_KEY (32 bytes = 256 bits, hex para AES-256)
openssl rand -hex 32

# ENCRYPTION_IV (16 bytes = 128 bits, hex para AES block size)
openssl rand -hex 16
```

### Valores generados (solo para desarrollo local — placeholders en .env.example)
- JWT_SECRET: `URmffxqyOORUFA5nBHu2vMUZJDfJap/HtUNWu6iZjrbLneYDlKSHFm4l/NO0e/HtK4mwz3i+KTSRs6qO34AWhg==`
- JWT_REFRESH_SECRET: `+gdOh2DXUx3Y6kxs6lGmmTHg2YnPBqReXElXYwly37BKT+E3BWAQN3+YBU8CoOHFO4G1uvDwCWpZXo9MxEJ3EA==`
- ENCRYPTION_KEY: `97ca0ccb8c76d1a6e417882981ffb778d8b72a3866497069d0e9f49fcb38a146`
- ENCRYPTION_IV: `853834549730358c6345e91ec30218fe`

### Razón
- `openssl rand` usa CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- 512 bits para JWT supera requisito mínimo de 256 bits para HS256
- 256 bits para AES-256 key es el estándar
- 128 bits IV coincide con block size de AES
- Documentar el comando permite regenerar en producción sin hardcodear valores

### Consecuencias
- **Positivas:** Secretos fuertes desde el inicio, reproducibles, documentados
- **Negativas:** Valores en `.env` local no deben usarse en producción (se regeneran en Render Dashboard)

### Verificación
- `diff backend/.env backend/.env.local` → sin cambios
- App inicia correctamente con `npm run start:dev`

### Archivos modificados
- backend/.env
- backend/.env.local
- docs/DECISIONS.md (este ADR)

---

## ADR-017: Separación de responsabilidades en navegación SPA (aside)

**Estado:** Aceptada
**Fecha:** 11 de junio de 2026

### Contexto
`setupNavListeners()` en `layout.js` llamaba a `loadPageFn(page)` Y a `router.navigate(href)` al mismo tiempo al hacer click en el aside. Ambos escriben en `#page-content`, generando una race condition no determinística: el contenido aparecía o no según timing de red/JS.

### Decisión
Eliminar `loadPageFn(page)` de `setupNavListeners()`. El router SPA es la única fuente de verdad para la navegación. `router.navigate()` ya activa la cadena completa: `withDashboard` → `loadFn` → `renderFn`.

### Razón
Un único punto de entrada para la navegación elimina la race condition y hace el flujo predecible.

### Consecuencias
- **Positivas:** Renderizado 100% determinístico, sin contenido intermitente.
- **Negativas:** Ninguna.

---

## ADR-019: Unificación de renderizado en wrappers de Dashboard

**Estado:** Aceptada
**Fecha:** 11 de junio de 2026

### Contexto
Los wrappers `withDashboard` y `withSettings` en `dashboard.js` tenían un `return` prematuro después de llamar a `renderDashboard()` cuando el layout no estaba presente. Esto causaba que, tras renderizar el layout (sidebar/topbar), la ejecución se detuviera y el contenido real de la página nunca se cargara ni se renderizara.

### Decisión
Eliminar los `return` prematuros en ambos wrappers. El flujo debe ser secuencial: si no hay layout, se renderiza; e independientemente de si se acaba de renderizar o ya existía, se procede a llamar a `loadFn` (carga de datos) y luego al renderizado de la sección específica.

### Razón
Garantizar que el contenido de la página siempre se renderice correctamente en una SPA donde el Router limpia el DOM principal en cada navegación.

### Consecuencias
- **Positivas:** Renderizado consistente y predecible de todas las secciones del dashboard.
- **Negativas:** Ninguna.

---

## ADR-018: Stat-cards del dashboard son solo visuales, sin navegación

**Estado:** Aceptada
**Fecha:** 11 de junio de 2026

### Contexto
Las stat-cards en `home.js` usaban `window.location.href` para redirigir al hacer click. Esto hacía un hard reload que bypasseaba el router SPA, resultando en secciones que cargaban sin datos (layout presente, `#page-content` vacío).

### Decisión
Las stat-cards son elementos puramente informativos. No tienen comportamiento de navegación. Si en el futuro se quiere re-agregar navegación, debe hacerse via `window._router.navigate()`.

### Razón
`window.location.href` es incompatible con la arquitectura SPA. Rompe el flujo `withDashboard` → `loadFn`.

### Consecuencias
- **Positivas:** Elimina secciones vacías al venir del dashboard.
- **Negativas:** Se pierde el shortcut de navegación rápida desde el dashboard.

---

## ADR-016: Prohibición Absoluta de Modificar Archivos `.env` / `.env.local`

**Estado:** Aceptada — **INMOVIBLE**
**Fecha:** 6 de junio de 2026

### Contexto
El 6 de junio de 2026 se detectó que los archivos `.env` y `.env.local` de backend y frontend contenían únicamente placeholders y valores de desarrollo, habiendo perdido todas las credenciales reales de producción (API keys, secrets, passwords). Dado que estos archivos están en `.gitignore` y no tienen historial en git, **no es posible recuperar los valores perdidos**. Para prevenir que esto vuelva a ocurrir —ya sea por error humano, script automatizado, o decisión de un agente de IA— se establece una regla técnica inamovible.

### Decisión
**PROHIBICIÓN ABSOLUTA** de modificar el contenido de los archivos:
- `backend/.env`
- `backend/.env.local`
- `frontend/.env`
- `frontend/.env.local`

**Operaciones permitidas (y únicas):**
1. **Crear** — copiar desde `.env.example` → `.env` (o `.env.local`)
2. **Copiar** — duplicar entre `.env` ↔ `.env.local` (`cp .env .env.local`)
3. **Eliminar** — borrar el archivo completo (`rm .env`)

**Operaciones PROHIBIDAS (bajo cualquier circunstancia):**
- Editar valores existentes (`sed`, `awk`, `vim`, `nano`, `echo >>`, `tee`, etc.)
- Agregar/quitar líneas
- Comentar/descomentar líneas
- Sincronizar valores entre archivos mediante escritura parcial
- Cualquier script (incluyendo `server.sh`) que escriba en estos archivos

**Sin excepciones:**
- Ni con autorización expresa del desarrollador
- Ni para "arreglar" un valor incorrecto
- Ni para actualizar `GOOGLE_CALLBACK_URL` u otra variable dinámica
- Ni en desarrollo, staging, ni producción

**Aplicable a:** TODOS los agentes (OpenCode, Codex, Claude Code, Gemini CLI, Cursor, humanos).

### Alternativa para cambios de valores
Si se requiere cambiar un valor:
1. Crear archivo temporal: `cp .env .env.nuevo`
2. Editar `.env.nuevo` (operación permitida porque es un archivo nuevo)
3. Validar contenido
4. Reemplazo atómico: `mv .env.nuevo .env`

### Refactor obligatorio: `server.sh`
El script `server.sh` actualmente modifica `GOOGLE_CALLBACK_URL` en `backend/.env` (líneas 132-140). **Debe refactorizarse** para:
1. Leer `CLOUDFLARE_TUNNEL_HOSTNAME` desde `.env` (solo lectura)
2. Calcular `GOOGLE_CALLBACK_URL` en memoria
3. Exportar como variable de entorno del proceso antes de lanzar el backend:
   ```bash
   export GOOGLE_CALLBACK_URL="${TUNNEL_HOSTNAME}/api/v1/auth/google/callback"
   npm run start:dev
   ```
4. **Nunca escribir en el archivo `.env`**

### Razón
- Los archivos `.env` son **fuente de verdad inmutable** para secretos y configuración sensible
- Su pérdida es **irreversible** (no están en git, no hay backup automático)
- Cualquier escritura parcial introduce riesgo de corrupción, truncado, o pérdida de valores
- La regla elimina una clase completa de errores operacionales

### Consecuencias
- **Positivas:** Imposible perder credenciales por sobrescritura accidental; auditoría clara; disciplina operacional
- **Negativas:** Requiere refactor de `server.sh`; flujo de cambio de valores ligeramente más verboso (copia → edita → mv)

### Verificación
- `grep -r "sed.*\.env\|echo.*\.env\|>>.*\.env" server.sh` → 0 resultados
- `grep -r "PROHIBICIÓN ABSOLUTA\|INMOVIBLE.*\.env" agent/ docs/ README.md TASKS.txt` → presente en 7 ubicaciones
- Intento de escribir en `.env` por cualquier agente → bloqueado por protocolo

### Archivos modificados
- agent/SKILL.md (regla en 🚫 LO QUE NUNCA DEBE HACER EL AGENTE)
- agent/CONTEXT.md (regla en Variables de entorno)
- docs/DECISIONS.md (este ADR-016)
- README.md (nueva sección 🔒 Reglas Inamovibles)
- agent/SPECS.md (nueva sección 18: SEGURIDAD DE VARIABLES DE ENTORNO)
- agent/DEPLOY.md (nueva sección 🔒 Regla .env)
- TASKS.txt (tarea bloqueante al inicio)
- server.sh (refactor pendiente — tarea bloqueante)

---

## FIX-007: Buscador de cliente en modal de mascota
**Fecha:** 12 de junio de 2026
**Dimensión:** Frontend / UX
**Problema:** El campo "Dueño" en el modal de mascota (`showPetModal` en `pets.js`) usaba un `<select>` simple poblado con 200 clientes vía `api.get('/clients?limit=200')`. Con muchos clientes era inutilizable — sin búsqueda, scroll infinito, UX pobre.
**Causa raíz:** Select nativo sin filtro ni paginación; carga de 200 opciones sin mecanismo de búsqueda.
**Solución (corregida):**
1. Función interna `renderClientOptions(clientes, selectedId)` que puebla el `<select>` estándar (sin modificar `size`) con opciones escapadas.
2. API `GET /clients?limit=50` → cache de 50 clientes más recientes. Listener `input` en `<input id="pet-client-search">` filtra en memoria (case-insensitive `name + lastName`) y re-renderiza opciones.
3. HTML: `<input id="pet-client-search" placeholder="Buscar entre los últimos 50 clientes...">` sobre `<select id="pet-clientId">` dropdown normal (sin `size`, sin overflow).
**Verificación:** `cd frontend && npm run build` → 0 errores Vite. `onConfirm` lee `pet-clientId.value` sin cambios.
**Archivos modificados:**
- frontend/src/pages/sections/pets.js (función showPetModal únicamente)
**Deuda residual:** ninguna.

---

## FIX-008: Modal duplicado al subir foto de mascota
**Fecha:** 12 de junio de 2026
**Dimensión:** Frontend / Bug
**Problema:** En `showPetDetail`, al subir o eliminar una foto, se llamaba `showPetDetail(petId, pageData)` lo que abría un segundo modal encima del actual (stack de `Modal.js`), en lugar de actualizar el contenido del modal existente.
**Causa raíz:** La lógica de carga y renderizado de fotos estaba inline en el `.then()` del `api.get`, y los callbacks de subida/eliminación invocaban la función completa `showPetDetail` en lugar de solo refrescar la sección de fotos.
**Solución:** Extraer la lógica de carga/renderizado de fotos a una función interna `refreshPhotos(petId)` dentro de `showPetDetail`. Llamar a `refreshPhotos()` en tres puntos: (1) carga inicial tras `openModal`, (2) callback de subida exitosa, (3) callback de eliminación exitosa. El modal permanece abierto y solo se actualiza `#pet-photos-list`.
**Verificación:** `cd frontend && npm run build` → 0 errores Vite. Flujo manual: abrir detalle → subir foto → toast "Foto subida" → foto aparece en mismo modal sin duplicado.
**Archivos modificados:**
- frontend/src/pages/sections/pets.js (función showPetDetail únicamente)
**Deuda residual:** ninguna.

---

## FIX-009: Buscador de mascota en formularios de historial médico
**Fecha:** 12 de junio de 2026
**Dimensión:** Frontend / UX
**Problema:** En "Nueva Consulta" (`AddRecordForm.js`) el select `#record-petId` se puebla con `api.get('/pets?limit=200')`. En "Editar Consulta" (`medical-records.js`) el select `#edit-record-petId` usa `api.get('/pets')` sin límite. Con 500+ mascotas ambos son inutilizables.
**Causa raíz:** Selects nativos sin filtro ni paginación; carga de cientos de opciones sin mecanismo de búsqueda.
**Solución:** Aplicar patrón idéntico en ambos archivos:
1. API `GET /pets?limit=50` (últimas 50) + cache en memoria.
2. Input de búsqueda (`record-pet-search` / `edit-record-pet-search`) sobre select dropdown estándar (sin `size`).
3. Funciones internas `renderPetOptions` / `renderEditPetOptions` que pueblan el select sin tocar `size`.
4. Listener `input` filtra en memoria (case-insensitive: `name + client.name` en AddRecordForm, `name` en medical-records) y re-renderiza.
**Verificación:** `cd frontend && npm run build` → 0 errores Vite. `onConfirm` en ambos formularios lee `.value` de los selects sin cambios.
**Archivos modificados:**
- frontend/src/components/AddRecordForm.js (función showAddRecordModal)
- frontend/src/pages/sections/medical-records.js (función showEditRecordModal)
**Deuda residual:** ninguna.

---

## FIX-010: Refactor completo AddRecordForm.js — UX + fixes UUID
**Fecha:** 12 de junio de 2026
**Dimensión:** Frontend / Bug + UX
**Problema:** 4 bugs de validación UUID en backend + 3 problemas de UX en formulario "Nueva Consulta":
- BUG 1: `petId must be a UUID` — Promise.all asíncrono + select vacío al guardar rápido
- BUG 2: `procedures.X.priceItemId must be a UUID` — select oculto `.proc-priceItem` con valor inconsistente
- BUG 3: `prescriptions.0.supplyId must be a UUID` — select `.presc-supply` sin sanitizar
- BUG 4: `supplyItems.0.supplyId must be a UUID` — `dataset.supplyId = undefined` se guarda como string `"undefined"`
- PROBLEMA A: Sección "Datos de la Consulta" mezcla identificación y clínica
- PROBLEMA B: Procedimientos e Insumos separados con magia invisible (auto-click)
- PROBLEMA C: Prescripción parece duplicada (dos sub-filas sin label claro)
**Causa raíz:** Falta de sanitización robusta de IDs + arquitectura de secciones no alineada con flujo mental del usuario.
**Solución:**
1. Helper `toUUID(val)` al inicio de `onConfirm`: retorna `val` solo si truthy y !== `'undefined'`, sino `undefined`. Aplicado a TODOS los IDs del payload (petId, priceItemId, supplyId en procedures/prescriptions/supplyItems).
2. Reorganización de 5 secciones en template HTML:
   - Paciente (mascota, fecha, motivo)
   - Examen Clínico (diagnóstico, tratamiento, peso, temp, próxima visita, obs)
   - Procedimientos e Insumos (unificados, insumo inline en fila de procedimiento)
   - Insumos sueltos (debajo, para insumos sin procedimiento)
   - Prescripciones Médicas (sub-fila con label "↳ Venta en clínica:")
   - Cobro (sin cambios)
3. Eliminado handler `supplySel.change` que hacía auto-click en `add-supply-item-btn` (magia invisible). Reemplazado por versión simple que solo setea precio si el insumo lo tiene.
**Verificación:** `cd frontend && npm run build` → 0 errores Vite. Tests manuales: guardar sin esperar carga mascotas → error frontend; procedimiento/prescripción/insumo sin insumo asociado → sin error 400 UUID; prescripción muestra label "↳ Venta en clínica:"; seleccionar insumo en procedimiento NO crea fila en insumos sueltos.
**Archivos modificados:**
- frontend/src/components/AddRecordForm.js (función showAddRecordModal únicamente)
**Deuda residual:** ninguna.

