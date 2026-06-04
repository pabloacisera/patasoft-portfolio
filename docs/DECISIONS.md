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
El archivo `backend/src/ai-proxy/ai-proxy.service.ts` tiene `SCALE_MODE` con default `'PRO'` (usa ai-service). Para usar el modo local (más económico), se debe configurar explícitamente `SCALE_MODE=local` en el `.env` de producción. Sin esta configuración, el sistema intentará usar el ai-service y fallará si no está desplegado.

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
