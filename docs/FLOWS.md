# PataSoft - Flujos de Negocio

## 1. Flujo de Autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant G as Google OAuth

    Note over U,G: === Registro Local ===
    U->>FE: Completa formulario de registro
    FE->>BE: POST /api/v1/auth/register {email, password, name}
    BE->>DB: Verifica email no existe
    BE->>BE: bcrypt hash (12 rounds)
    BE->>DB: INSERT User
    BE->>BE: Genera JWT access (7d) + refresh (30d)
    BE->>DB: INSERT RefreshToken
    BE-->>FE: {accessToken, refreshToken, user}
    FE->>FE: Guarda en localStorage (patasoft_auth)
    FE->>FE: Redirect a /onboarding

    Note over U,G: === Login Local ===
    U->>FE: Ingresa email + password
    FE->>BE: POST /api/v1/auth/login {email, password}
    BE->>DB: Busca User por email
    BE->>BE: bcrypt compare
    BE->>BE: Genera nuevos tokens
    BE->>DB: Upsert RefreshToken
    BE-->>FE: {accessToken, refreshToken, user}
    FE->>FE: Guarda tokens + redirect a /dashboard/home

    Note over U,G: === Google OAuth ===
    U->>FE: Click "Iniciar con Google"
    FE->>BE: Redirect a /api/v1/auth/google
    BE->>G: Passport Google Strategy
    G-->>BE: {googleId, email, name}
    BE->>DB: Busca User por googleId o email
    alt Usuario nuevo
        BE->>DB: Crea User con googleId
    end
    BE->>BE: Genera tokens
    BE-->>FE: Redirect /auth/callback?token=...&refresh=...
    FE->>FE: Extrae tokens de URL, guarda en localStorage

    Note over U,G: === Refresh Token ===
    FE->>BE: Request con token expirado
    BE-->>FE: 401 Unauthorized
    FE->>BE: POST /api/v1/auth/refresh {refreshToken}
    BE->>DB: Verifica RefreshToken válido
    BE->>DB: Elimina RefreshToken viejo
    BE->>BE: Genera nuevos tokens
    BE->>DB: INSERT nuevo RefreshToken
    BE-->>FE: {accessToken, refreshToken}
    FE->>FE: Actualiza tokens, reintenta request original

    Note over U,G: === JwtAuthGuard (cada request) ===
    FE->>BE: Request con Authorization: Bearer <token>
    BE->>BE: Verifica JWT válido
    BE->>BE: Verifica @Public() decorator
    BE->>DB: Consulta Subscription por companyId
    alt Suscripción válida
        BE-->>FE: 200 OK
    else Suscripción expirada
        BE-->>FE: 403 SUBSCRIPTION_EXPIRED
    else Sin empresa
        BE-->>FE: 403 ONBOARDING_REQUIRED
    end
```

## 2. Flujo de Consulta Médica (FLUJO MÁS COMPLEJO)

```mermaid
sequenceDiagram
    participant VET as Veterinario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant RAG as Local RAG
    participant PDF as PDF Service
    participant CASH as Cash Register

    VET->>FE: Abre "Nueva Consulta"
    FE->>BE: GET /api/v1/pets?companyId=X
    BE-->>FE: Lista de mascotas
    VET->>FE: Selecciona mascota, completa formulario:
    FE->>FE: Agrega procedimientos (con supplyId)
    FE->>FE: Agrega prescripciones (con soldInClinic)
    FE->>FE: Selecciona método de pago
    FE->>FE: Calcula total (recalcRecordTotal)

    VET->>FE: Click "Guardar Consulta"
    FE->>BE: POST /api/v1/medical-records {petId, procedures, prescriptions, payment}

    Note over BE,DB: === TRANSACCIÓN ATÓMICA ===
    BE->>DB: 1. Valida Pet existe y pertenece a Company
    BE->>BE: 2. Calcula total:
    BE->>DB:    - Busca PriceItem por procedure
    BE->>DB:    - Calcula Supply.salePrice/unitsPerStock
    BE->>DB:    - Suma prescriptions (soldInClinic)

    BE->>DB: 3. INSERT MedicalRecord (con procedures + prescriptions anidados)

    rect rgb(255, 245, 230)
        Note over BE,DB: Descuento de Stock
        loop Cada procedure con supplyId
            BE->>DB: UPDATE Supply SET stock = stock - quantity
        end
        loop Cada prescription con soldInClinic=true
            BE->>DB: UPDATE Supply SET stock = stock - 1
        end
    end

    rect rgb(230, 255, 230)
        Note over BE,DB: Creación de Pago
        BE->>DB: INSERT Payment {totalAmount, status, method}
        loop Cada item
            BE->>DB: INSERT PaymentItem {description, amount, supplyId}
        end
    end

    Note over BE,DB: === POST-TRANSACCIÓN (fire-and-forget) ===

    alt Método de pago = CASH
        BE->>CASH: createFromPayment(paymentId, amount)
        CASH->>DB: INSERT CashMovement {type: INCOME}
    end

    BE->>PDF: generateAndStorePdfs(recordId, paymentId) [background]
    PDF->>DB: Lee datos de record + prescription + payment
    PDF->>PDF: Puppeteer renderiza HTML (Handlebars)
    PDF->>PDF: Genera PDF bytes
    PDF->>BE: Sube a Cloudinary
    PDF->>DB: INSERT Document {cloudinaryUrl, type}

    BE->>RAG: upsertEmbedding(companyId, content, metadata) [background]
    RAG->>RAG: Gemini genera embedding (768 dim)
    RAG->>DB: INSERT/UPDATE langchain_vectors

    BE-->>FE: {record, payment}
    FE->>FE: Muestra toast "Consulta creada"
    FE->>FE: Actualiza lista de historiales
```

## 3. Flujo de Pagos

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant MP as MercadoPago
    participant CASH as Cash Register

    Note over U,CASH: === Pago Directo (Efectivo) ===
    U->>FE: Click "Nuevo Cobro"
    FE->>BE: GET /api/v1/clients (autocomplete)
    FE->>BE: GET /api/v1/price-items (items)
    U->>FE: Selecciona cliente, agrega items, método=CASH
    FE->>BE: POST /api/v1/payments {clientId, items, method: CASH, status: PAID}
    BE->>DB: INSERT Payment + PaymentItems
    BE->>DB: UPDATE Supply (descuento stock si supplyId)
    BE->>CASH: createFromPayment → INSERT CashMovement INCOME
    BE->>BE: Genera PDF comprobante [background]
    BE-->>FE: Payment creado

    Note over U,CASH: === Pago con MercadoPago (Checkout Pro) ===
    U->>FE: Click "Cobrar con MercadoPago"
    FE->>BE: POST /api/v1/payments/:id/checkout
    BE->>MP: Crea preferencia de pago
    MP-->>BE: {initPoint: "https://mp.com/checkout/..."}
    BE-->>FE: URL de checkout
    FE->>U: Redirect a MercadoPago
    U->>MP: Completa pago en MP
    MP->>BE: Webhook POST /api/v1/mercadopago/webhook
    BE->>MP: Consulta detalle del pago
    BE->>DB: UPDATE Payment SET status=PAID, paidAt=now
    BE->>DB: UPDATE Debt SET status=PAID (si existe)
    BE->>CASH: Crea CashMovement si no existe
    BE->>BE: Genera PDF comprobante [background]

    Note over U,CASH: === Pago Diferido (Deuda) ===
    U->>FE: Crea pago con método=DEFERRED
    FE->>BE: POST /api/v1/payments {method: DEFERRED, dueDate: "2026-06-15"}
    BE->>DB: INSERT Payment (status: PENDING)
    BE->>DB: INSERT Debt {amount, dueDate, status: PENDING}
    BE-->>FE: Payment + Debt creados
```

## 4. Flujo de Suscripciones

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant MP as MercadoPago
    participant WS as WebSocket
    participant CRON as Cron Service

    Note over U,CRON: === Inicio de Trial ===
    U->>FE: Completa onboarding (crea empresa)
    FE->>BE: POST /api/v1/companies
    BE->>DB: INSERT Company
    BE->>DB: INSERT Subscription {plan: TRIAL, status: ACTIVE, trialEndsAt: +30d}
    BE-->>FE: Empresa creada con trial activo

    Note over U,CRON: === Upgrade a Plan Pago ===
    U->>FE: Settings > Suscripción > "Suscribirse"
    FE->>BE: POST /api/v1/subscriptions/checkout {plan: MONTHLY}
    BE->>MP: Crea preferencia de suscripción
    MP-->>BE: {initPoint}
    BE-->>FE: URL de checkout
    U->>MP: Paga suscripción
    MP->>BE: Webhook POST /api/v1/subscriptions/webhook
    BE->>MP: Verifica pago aprobado
    BE->>DB: Upsert Subscription {plan: MONTHLY, status: ACTIVE, expiresAt: +30d}
    BE->>DB: UPDATE Company SET isBlocked=false

    Note over U,CRON: === Expiración (Cron diario 10AM) ===
    CRON->>BE: checkExpirations()
    BE->>DB: Busca subscriptions ACTIVE con expiresAt < now
    BE->>DB: Busca subscriptions TRIAL con trialEndsAt < now
    loop Cada suscripción expirada
        BE->>DB: UPDATE Subscription SET status=EXPIRED
        BE->>DB: UPDATE Company SET isBlocked=true
        BE->>DB: INSERT Notification (suscripción vencida)
        BE->>WS: Emite "company:blocked" a room company:{id}
    end

    Note over U,CRON: === Cuenta Bloqueada ===
    WS-->>FE: Evento "company:blocked"
    FE->>FE: Muestra pantalla/banner de bloqueo
    FE->>FE: Solo permite /settings/subscription y /settings/export-data
```

## 5. Flujo de Deudas

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant CASH as Cash Register
    participant WS as WebSocket
    participant CRON as Cron Service

    Note over U,CRON: === Creación de Deuda ===
    U->>FE: Crea pago diferido
    BE->>DB: INSERT Debt {amount, dueDate, interestRate, status: PENDING}

    Note over U,CRON: === Alertas (Cron diario 8AM) ===
    CRON->>BE: processAlerts()
    BE->>DB: UPDATE Debt SET status=OVERDUE WHERE dueDate < now AND status=PENDING
    BE->>DB: Busca deudas que vencen en 2 días (alertSent2Day=false)
    BE->>DB: Busca deudas que vencen en 1 día (alertSent1Day=false)
    BE->>DB: Busca deudas OVERDUE
    loop Cada deuda a notificar
        BE->>DB: INSERT Notification (DEBT_DUE o DEBT_OVERDUE)
        BE->>DB: UPDATE Debt SET alertSent2Day/alertSent1Day = true
        BE->>WS: Emite "debt:alert" a room company:{id}
    end

    Note over U,CRON: === Pago de Deuda ===
    U->>FE: Click "Pagar" en deuda
    FE->>BE: POST /api/v1/debts/:id/pay {method, amount}
    BE->>BE: Calcula monto con interés (calculateDebtAmount)
    BE->>BE: Determina si es pago parcial o total

    alt Pago Parcial
        BE->>DB: UPDATE Debt SET amount = amount - paidAmount
        BE->>DB: UPDATE Payment SET paidAmount += amount
    else Pago Total
        BE->>DB: UPDATE Debt SET status=PAID, paidAt=now
        BE->>DB: UPDATE Payment SET status=PAID, paidAmount=total
        BE->>CASH: createFromPayment → INSERT CashMovement INCOME
    end
```

## 6. Flujo RAG (Retrieval-Augmented Generation)

```mermaid
sequenceDiagram
    participant U as Veterinario
    participant FE as Frontend
    participant BE as Backend (NestJS)
    participant GEM as Google Gemini
    participant GROQ as Groq (Llama 3.3)
    participant PG as PostgreSQL (pgvector)

    Note over U,PG: === Ingestión de Datos ===
    U->>FE: Settings > IA > "Sincronizar datos"
    FE->>BE: POST /api/v1/ai/ingest (SSE)
    BE->>BE: RagIngestionService.ingestCompanyData()

    rect rgb(230, 240, 255)
        Note over BE,PG: Recopila 7 categorías
        BE->>PG: Lee Company (1 doc)
        BE->>PG: Lee Clients (N docs)
        BE->>PG: Lee Pets (N docs)
        BE->>PG: Lee Supplies (N docs)
        BE->>PG: Lee PriceItems (N docs)
        BE->>PG: Lee MedicalRecords (max 100)
        BE->>PG: Lee Payments (max 200)
    end

    BE->>PG: DELETE FROM langchain_vectors WHERE companyId=X
    loop Cada lote de 5 documentos
        BE->>GEM: POST embeddings (gemini-embedding-2-preview)
        GEM-->>BE: float[768] por documento
        BE->>PG: INSERT INTO langchain_vectors (embedding, content, metadata)
        BE-->>FE: SSE: progreso (X/Y documentos)
    end

    Note over U,PG: === Consulta RAG ===
    U->>FE: Escribe pregunta en chat IA
    FE->>BE: POST /api/v1/ai/chat/stream {message, history}
    BE->>GEM: POST embedding de la pregunta
    GEM-->>BE: float[768]
    BE->>PG: SELECT * FROM langchain_vectors<br/>WHERE companyId=X<br/>ORDER BY embedding <=> query_vector<br/>LIMIT 15
    PG-->>BE: 15 documentos más similares

    BE->>BE: Construye system prompt con contexto
    BE->>GROQ: POST chat/completions (streaming)<br/>model: llama-3.3-70b-versatile<br/>system: "SOS UN ASISTENTE VETERINARIO..."<br/>context: [15 documentos]
    GROQ-->>BE: Stream de tokens
    BE-->>FE: SSE: stream de texto
    FE->>FE: Renderiza respuesta en tiempo real
```

## 7. Flujo de Onboarding

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Se registra (email/password o Google)
    FE->>BE: POST /api/v1/auth/register
    BE-->>FE: {accessToken, refreshToken, user}
    FE->>FE: Guarda tokens en localStorage

    FE->>BE: GET /api/v1/companies/me
    BE-->>FE: 403 ONBOARDING_REQUIRED (sin companyId)
    FE->>FE: Redirect a /onboarding

    Note over U,DB: === Wizard de Onboarding (StepForm) ===
    U->>FE: Paso 1: Datos de la empresa
    FE->>FE: Nombre, slug, email, teléfono, dirección
    U->>FE: Paso 2: Configuración inicial
    FE->>FE: Moneda, idioma
    U->>FE: Paso 3: Confirmación
    FE->>BE: POST /api/v1/companies {name, slug, ...}
    BE->>DB: INSERT Company
    BE->>DB: INSERT CompanyConfig (defaults)
    BE->>DB: INSERT Subscription {plan: TRIAL, trialEndsAt: +30d}
    BE-->>FE: {company, config}
    FE->>FE: Guarda company en localStorage (patasoft_company)
    FE->>FE: Redirect a /dashboard/home

    Note over U,DB: === Post-Onboarding ===
    FE->>BE: Conecta WebSocket con companyId
    FE->>FE: Renderiza dashboard con sidebar completo
    FE->>FE: Muestra banner de trial (30 días restantes)
```

## 8. Flujo de WebSocket (Tiempo Real)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant WS as WebSocket Gateway
    participant BE as Backend Services
    participant RD as Redis

    FE->>WS: connect(auth: {token: JWT})
    WS->>WS: Verifica JWT
    WS->>WS: Join room "company:{companyId}"
    WS->>WS: Join room "user:{userId}"
    WS-->>FE: Conectado

    Note over FE,RD: === Evento: Nueva Notificación ===
    BE->>WS: server.to("company:X").emit("notification:new", notification)
    WS-->>FE: notification:new
    FE->>FE: Agrega a notifications store
    FE->>FE: Actualiza badge de campana

    Note over FE,RD: === Evento: Documento Listo ===
    BE->>WS: server.to("company:X").emit("document:ready", {url, type})
    WS-->>FE: document:ready
    FE->>FE: Muestra toast "Documento listo para descargar"

    Note over FE,RD: === Evento: Alerta de Stock ===
    BE->>WS: server.to("company:X").emit("stock:alert", supply)
    WS-->>FE: stock:alert
    FE->>FE: Muestra notificación de stock bajo

    Note over FE,RD: === Evento: Cuenta Bloqueada ===
    BE->>WS: server.to("company:X").emit("company:blocked", {reason})
    WS-->>FE: company:blocked
    FE->>FE: Muestra pantalla de bloqueo
```
