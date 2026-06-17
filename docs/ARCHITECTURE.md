# PataSoft - Arquitectura del Sistema

## Diagrama de Componentes del Sistema

```mermaid
graph TB
    subgraph "Frontend (Vite + Vanilla JS)"
        UI[SPA Frontend<br/>Puerto 5173/80]
    end

    subgraph "Backend (NestJS)"
        API[API REST<br/>Puerto 3000]
        WS[WebSocket Gateway<br/>Socket.IO]
        AUTH[Auth Module<br/>JWT + Google OAuth]
        BIZ[Business Modules<br/>30 módulos]
        RAG_LOCAL[Local RAG<br/>pgvector + Groq]
    end

    subgraph "AI Service (FastAPI)"
        AI_API[AI API<br/>Puerto 8000]
        AGENT[LangChain Agent<br/>+ 6 Tools]
        RAG_PY[RAG Module<br/>ChromaDB]
        MEMORY[Company Memory<br/>Redis]
    end

    subgraph "Infraestructura (Render.com)"
        PG[(PostgreSQL<br/>+ pgvector)]
        RD[(Redis<br/>Key-Value Store)]
        CL[Cloudinary<br/>File Storage]
    end

    subgraph "Servicios Externos"
        MP[MercadoPago<br/>Pagos + Suscripciones]
        MJ[Mailjet<br/>Email Transaccional]
        GEMINI[Google Gemini<br/>Embeddings]
        GROQ[Groq<br/>LLM Llama 3.3 70B]
        OPENAI[OpenAI<br/>GPT-4o + Whisper]
        GOOGLE[Google OAuth<br/>Autenticación]
    end

    UI -->|HTTP /api| API
    UI -->|WebSocket| WS
    API --> AUTH
    API --> BIZ
    API -->|Proxy AI| AI_API
    API --> RAG_LOCAL
    RAG_LOCAL --> PG
    RAG_LOCAL --> GEMINI
    RAG_LOCAL --> GROQ

    AI_API --> AGENT
    AI_API --> RAG_PY
    AI_API --> MEMORY
    AGENT --> PG
    RAG_PY --> PG
    MEMORY --> RD

    API --> PG
    API --> RD
    API --> CL
    API --> MP
    API --> MJ
    AUTH --> GOOGLE
    AUTH --> PG
    WS --> RD
```

## Diagrama de Módulos del Backend (NestJS)

```mermaid
graph LR
    subgraph "Infraestructura"
        CONFIG[ConfigModule<br/>Global]
        PRISMA[PrismaModule<br/>Global]
        REDIS[RedisModule<br/>Global]
        QUEUES[QueuesModule<br/>BullMQ]
        CLOUDINARY[CloudinaryModule]
        HEALTH[HealthModule]
    end

    subgraph "Autenticación"
        AUTH[AuthModule<br/>JWT + Passport]
        USERS[UsersModule]
        GUEST[GuestModule<br/>Redis Sessions]
    end

    subgraph "Dominio Principal"
        COMPANIES[CompaniesModule]
        CLIENTS[ClientsModule]
        PETS[PetsModule]
        MR[MedicalRecordsModule]
        PAYMENTS[PaymentsModule]
        DEBTS[DebtsModule]
        SUPPLIES[SuppliesModule]
        PRICES[PriceItemsModule]
    end

    subgraph "Dominio Secundario"
        CASH[CashRegisterModule]
        NOTIF[NotificationsModule]
        CONN[ConnectionsModule]
        DOCS[PdfModule<br/>Puppeteer]
        SUBS[SubscriptionsModule]
    end

    subgraph "Integraciones"
        MP[MercadopagoModule]
        MAIL[MailModule<br/>Mailjet]
        AI[AiProxyModule]
        EVENTS[EventsModule<br/>WebSocket]
    end

    subgraph "Administración"
        ADMIN[AdminModule]
        SUPER[SuperAdminModule]
        CRON[CronModule]
        DATA[DataModule]
        SPURCH[SupplyPurchasesModule]
    end

    MR --> PRISMA
    MR --> CASH
    MR --> DOCS
    MR --> AI
    PAYMENTS --> PRISMA
    PAYMENTS --> MP
    PAYMENTS --> CASH
    PAYMENTS --> DOCS
    DEBTS --> PRISMA
    DEBTS --> CASH
    DEBTS --> EVENTS
    SUBS --> PRISMA
    SUBS --> MP
    SUBS --> EVENTS
    AI --> PRISMA
    AUTH --> PRISMA
    COMPANIES --> PRISMA
```

## Diagrama ER Simplificado (Prisma)

```mermaid
erDiagram
    Company ||--o{ User : "tiene"
    Company ||--|| CompanyConfig : "configura"
    Company ||--|| Subscription : "suscribe"
    Company ||--o{ Client : "atiende"
    Company ||--o{ Supply : "almacena"
    Company ||--o{ PriceItem : "precia"
    Company ||--o{ Payment : "cobra"
    Company ||--o{ Debt : "registra"
    Company ||--o{ CashMovement : "caja"
    Company ||--o{ Notification : "notifica"
    Company ||--o{ Document : "archiva"

    Client ||--o{ Pet : "posee"
    Client ||--o{ Payment : "paga"
    Client ||--o{ Debt : "debe"

    Pet ||--o{ MedicalRecord : "historial"
    Pet ||--o{ PetPhoto : "fotos"

    MedicalRecord ||--o{ Procedure : "incluye"
    MedicalRecord ||--o{ Prescription : "receta"
    MedicalRecord ||--o| Payment : "factura"

    Payment ||--o{ PaymentItem : "items"
    Payment ||--o| Debt : "genera"

    Procedure }o--o| Supply : "consume"
    Prescription }o--o| Supply : "vende"

    User ||--o{ RefreshToken : "auth"

    Company {
        string id PK
        string name
        string slug UK
        string email
        boolean isBlocked
    }

    User {
        string id PK
        string name
        string email UK
        string password
        UserRole role
        string companyId FK
    }

    Subscription {
        string id PK
        SubscriptionPlan plan
        SubscriptionStatus status
        datetime expiresAt
        datetime trialEndsAt
        string companyId FK
    }

    Client {
        string id PK
        string name
        string dni
        string email
        string phone
        string companyId FK
    }

    Pet {
        string id PK
        string name
        string species
        string breed
        datetime birthDate
        string clientId FK
        string companyId FK
    }

    MedicalRecord {
        string id PK
        string reason
        string diagnosis
        string treatment
        string petId FK
        string companyId FK
    }

    Payment {
        string id PK
        decimal totalAmount
        PaymentStatus status
        PaymentMethod method
        string clientId FK
        string companyId FK
    }

    Supply {
        string id PK
        string name
        int stock
        decimal unitPrice
        decimal salePrice
        string companyId FK
    }
```

## Diagrama de Despliegue (Render.com)

```mermaid
graph TB
    subgraph "Render.com - us-east"
        subgraph "Static Site"
            FE[patasoft-frontend<br/>Vite build → Static files<br/>CDN global]
        end

        subgraph "Web Services"
            BE[patasoft-backend<br/>Node.js 20<br/>NestJS<br/>Auto-deploy]
            AI[patasoft-ai<br/>Python 3.11<br/>FastAPI<br/>Auto-deploy]
        end

        subgraph "Managed Services"
            DB[(patasoft-db<br/>PostgreSQL 15<br/>+ pgvector<br/>Free Plan)]
            KV[(patasoft-kv<br/>Redis<br/>Free Plan)]
        end
    end

    subgraph "Servicios Externos"
        CLOUD[Cloudinary<br/>Imágenes + Docs]
        MP_API[MercadoPago API]
        GEMINI_API[Google Gemini API]
        GROQ_API[Groq API]
        MJ_API[Mailjet API]
        GOOGLE_API[Google OAuth]
    end

    subgraph "Usuarios"
        BROWSER[Navegador<br/>SPA]
    end

    BROWSER -->|HTTPS| FE
    BROWSER -->|HTTPS /api| BE
    BROWSER -->|WSS| BE

    FE -->|Proxy /api| BE
    BE -->|HTTP| AI
    BE -->|TCP 5432| DB
    BE -->|TCP 6379| KV
    AI -->|TCP 5432| DB
    AI -->|TCP 6379| KV

    BE -->|REST| CLOUD
    BE -->|REST| MP_API
    BE -->|REST| MJ_API
    BE -->|OAuth| GOOGLE_API
    BE -->|REST| GEMINI_API
    BE -->|REST| GROQ_API
    AI -->|REST| GEMINI_API
    AI -->|REST| GROQ_API
```

## Stack Tecnológico

| Capa | Tecnología | Versión | Razón |
|------|-----------|---------|-------|
| **Frontend** | Vite + Vanilla JS | 5.4 | Simplicidad, sin curva de aprendizaje |
| **Backend** | NestJS + TypeScript | 10.x | Modularidad, enterprise-ready |
| **ORM** | Prisma | 5.22 | Type-safety, migraciones automáticas |
| **Base de datos** | PostgreSQL + pgvector | 15+ | Relacional + vectores para RAG |
| **Cache** | Redis | 7+ | Sesiones, cache de suscripción |
| **AI Service** | FastAPI + Python | 0.115 | Ecosistema LangChain, ML |
| **LLM** | Groq (Llama 3.3 70B) | - | Velocidad, costo cero |
| **Embeddings** | Google Gemini | - | 768 dimensiones, buen rendimiento |
| **Pagos** | MercadoPago | 2.12 | Mercado argentino, QR, checkout |
| **Email** | Mailjet | 6.x | Transaccional, templates |
| **Storage** | Cloudinary | 2.9 | Imágenes, PDFs, raw files |
| **Auth** | JWT + Passport | - | Access + Refresh tokens |
| **WebSockets** | Socket.IO | 4.8 | Tiempo real, notificaciones |
| **PDF** | Puppeteer + Handlebars | 22.x | Generación server-side |
| **Hosting** | Render.com | - | Free tier, auto-deploy |

### Organización de módulos (AppModule)

AppModule agrupa los módulos en capas:

**Infraestructura:** PrismaModule, RedisModule, QueuesModule, HealthModule

**Auth y Usuarios:** AuthModule, UsersModule, SubscriptionsModule, GuestModule

**Admin:** AdminModule, SuperAdminModule

**Dominio veterinario (VeterinaryModule):**
  CompaniesModule, ClientsModule, PetsModule, MedicalRecordsModule,
  PdfModule, PaymentsModule, DebtsModule, SuppliesModule,
  PriceItemsModule, CashRegisterModule, SupplyPurchasesModule, NotificationsModule

**Integraciones (IntegrationsModule):**
  CloudinaryModule, MercadopagoModule, MailModule,
  ConnectionsModule, AiProxyModule, EventsModule

**Soporte:** CronModule, DataModule

### Estructura de archivos y tipos

- **Shared Types:** `shared/src/types/` contiene tipos compartidos entre frontend y backend.
- **Response DTOs:** `backend/src/common/dto/response.dto.ts` define los objetos de respuesta estandarizados para la API (Swagger-ready).
- **Frontend Utilities:** `frontend/src/utils/` contiene helpers para sanitización, formateo y validación.

## Deuda Técnica y Roadmap (v1.1.0)

PataSoft reconoce los siguientes puntos de deuda técnica que serán abordados en el primer release mayor post-lanzamiento (v1.1.0):

### 1. Desacoplamiento de Módulos (Anti-patrón Circular)
Actualmente existen dependencias circulares (ej: `AiProxy` ↔ `Queues`) resueltas mediante `forwardRef`.
- **Plan:** Migrar a una arquitectura orientada a eventos usando `EventEmitter2` para desacoplar el procesamiento de documentos de la lógica de negocio de IA.

### 2. Serialización Estricta de Salida
Aunque se han implementado Response DTOs en los controladores principales, el sistema aún depende en parte de los tipos generados por Prisma.
- **Plan:** Implementar interceptores de serialización globales para asegurar que ninguna propiedad interna de la DB (como `password` o metadatos de sistema) se escape en las respuestas de la API.

### 3. Migración a Cookies httpOnly
Actualmente el Refresh Token reside en `localStorage`.
- **Plan:** Migrar el almacenamiento de tokens a cookies `httpOnly` y `Secure` para mitigar riesgos de ataques XSS.

