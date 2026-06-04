# Flujo de Documentos y Facturación

## Índice

1. [Tipos de Documentos](#1-tipos-de-documentos)
2. [Tecnología de Generación](#2-tecnología-de-generación)
3. [Flujo de Consulta → Factura](#3-flujo-de-consulta--factura)
4. [Flujo de Pago Directo (sin consulta)](#4-flujo-de-pago-directo-sin-consulta)
5. [Flujo de Compra de Insumos](#5-flujo-de-compra-de-insumos)
6. [Flujo de Gastos y Ajustes de Stock](#6-flujo-de-gastos-y-ajustes-de-stock)
7. [Visualización y Descarga de Documentos](#7-visualización-y-descarga-de-documentos)
8. [Endpoints por Controlador](#8-endpoints-por-controlador)
9. [Diagrama de Entidades](#9-diagrama-de-entidades)
10. [Oportunidades de Mejora](#10-oportunidades-de-mejora)

---

## 1. Tipos de Documentos

| Documento | Template | ¿Se persiste? | Tipo en `Document` | Disparadores |
|-----------|----------|--------------|-------------------|-------------|
| **Receta Veterinaria** | `prescription.hbs` | Sí (Cloudinary + DB) | `EXPORT_PDF` | Creación de consulta con prescripciones |
| **Comprobante / Recibo** | `receipt.hbs` | Sí (Cloudinary + DB) | `PAYMENT_RECEIPT` | Pago creado/actualizado a PAID, consulta con pago, webhook MP |
| **Historia Clínica** | `medical-history.hbs` | No (solo buffer en memoria) | — | Bajo demanda por endpoint |
| **Ficha de Mascota** | `pet-card.hbs` | No (solo buffer en memoria) | — | No expuesto directamente |

### Templates

- `src/documents/templates/receipt.hbs` — Comprobante interno con: datos empresa, datos cliente, items (descripción, cant, precio unit, subtotal), subtotal, IVA 21%, total, disclaimer "sin validez fiscal"
- `src/documents/templates/prescription.hbs` — Receta con: datos empresa, datos paciente/mascota, diagnóstico, prescripciones (medicamento, dosis, frecuencia, duración, estado: entregado en clínica / debe adquirir), firma profesional
- `src/documents/templates/medical-history.hbs` — Historia clínica completa con account statement
- `src/documents/templates/pet-card.hbs` — Ficha de mascota

---

## 2. Tecnología de Generación

**Servicio:** `src/documents/pdf.service.ts` — `PdfService`

**Pipeline:**
1. Handlebars compila el template `.hbs` con datos de Prisma
2. Puppeteer (headless Chromium) renderiza el HTML a PDF (A4)
3. Según el método:
   - `generateXxx()` → devuelve `Buffer` (no persiste)
   - `generateAndStoreXxx()` → sube a Cloudinary + guarda `Document` en DB

**Dependencias:**
- `handlebars` — compilación de templates
- `puppeteer` — HTML → PDF
- `@nestjs/bull` + `bull` — cola de procesos (no implementado aún, los PDFs se generan async con Promises sin await)
- `cloudinary` — almacenamiento en nube

### Cloudinary

- **Service:** `src/cloudinary/cloudinary.service.ts` — `CloudinaryService`
- **Config:** env vars `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Folders:** `patasoft/{company.slug}/comprobantes/` (recibos), `patasoft/{company.slug}/recetas/` (recetas)
- **Tipo de recurso:** `raw` (PDF, no imagen)

---

## 3. Flujo de Consulta → Factura

### Endpoint

```
POST /api/v1/medical-records
```

### Controlador

`src/medical-records/medical-records.controller.ts` — `MedicalRecordsController`
- Método: `create()` (línea 22)

### Servicio

`src/medical-records/medical-records.service.ts` — `MedicalRecordsService`

#### Método `create(companyId, dto)` — línea 89

```
POST /api/v1/medical-records
│
├── 1. Validar Pet (línea 91)
│
├── 2. Calcular monto total (líneas 96-157)
│   ├── Desde procedures[]:
│   │   ├── customPrice → usa ese
│   │   ├── priceItemId → busca PriceItem.price en DB
│   │   └── supplyId → Supply.salePrice / Supply.unitsPerStock
│   │   → PaymentItem { itemType: 'PROCEDURE' } (línea 125)
│   ├── Desde prescriptions[].soldInClinic=true:
│   │   → Supply.salePrice / Supply.unitsPerStock * dispensingQuantity
│   │   → PaymentItem { itemType: 'SUPPLY' } (línea 143)
│   └── Desde supplyItems[] directo:
│       → PaymentItem { itemType: 'SUPPLY' } (línea 155)
│
├── 3. Transacción atómica (Prisma $transaction) — línea 160
│   ├── Crear MedicalRecord (línea 165)
│   │   └── Nested: Procedure[] + Prescription[]
│   ├── Descontar stock de Supply para cada Procedure con supplyId (línea 184)
│   ├── Descontar stock de Supply para cada Prescription soldInClinic (línea 203)
│   └── Crear Payment con PaymentItem[] (línea 215)
│       └── Payment.medicalRecordId = record.id (relación 1:1 @unique)
│
├── 4. Post-transacción:
│   ├── Si CASH + PAID → CashMovement (INCOME) (línea 237)
│   │   └── cashService.createFromPayment(companyId, payment.id, amount)
│   ├── async: generateAndStorePdfs() (línea 247)
│   │   ├── pdfService.generateAndStorePrescription(recordId, companyId)
│   │   └── pdfService.generateAndStoreReceipt(paymentId, companyId)
│   └── async: RAG embedding (línea 251)
│
└── 5. Retorna { record, payment }
```

#### Método `generateAndStorePdfs(recordId, paymentId, companyId)` — línea 281

Dispara en paralelo (Promise.all sin await en el caller):
1. `pdfService.generateAndStorePrescription(recordId, companyId)` — `src/documents/pdf.service.ts:256`
2. `pdfService.generateAndStoreReceipt(paymentId, companyId)` — `src/documents/pdf.service.ts:341`

### Tablas DB afectadas

| Tabla | Acción |
|-------|--------|
| `MedicalRecord` | INSERT |
| `Procedure` | INSERT (nested) |
| `Prescription` | INSERT (nested) |
| `Payment` | INSERT (con `medicalRecordId`) |
| `PaymentItem` | INSERT (nested) |
| `Supply` | UPDATE `quantity -= stockUnitsUsed` |
| `CashMovement` | INSERT (solo si CASH + PAID) |
| `Document` | INSERT (desde generateAndStorePdfs) |

---

## 4. Flujo de Pago Directo (sin consulta)

### Endpoint

```
POST /api/v1/payments
```

### Controlador

`src/payments/payments.controller.ts` — `PaymentsController`
- Método: `create()` (línea 54)

### Servicio

`src/payments/payments.service.ts` — `PaymentsService`

#### Método `create(companyId, dto)` — línea 66

```
POST /api/v1/payments
│
├── 1. Recibe: clientId, totalAmount, method, status, dueDate, items[]
│   └── items[]: { description, quantity, unitPrice, totalPrice, itemType, supplyId? }
│
├── 2. Crear Payment con PaymentItem[] (línea 81)
│
├── 3. Descontar stock para cada item con supplyId (línea 92)
│   └── Supply.update({ quantity: { decrement: stockUnitsUsed } })
│
├── 4. Si CASH + PAID → CashMovement (INCOME) (línea 99)
│   └── cashService.createFromPayment(companyId, payment.id, paidAmount)
│
├── 5. Si método no confirmado (MP_QR, MP_CHECKOUT, TRANSFER, CHECK) + status no PAID → Debt (línea 110)
│   └── debtService.create(companyId, { paymentId, clientId, amount, dueDate })
│
├── 6. Si PAID → async: generateAndStoreReceipt(payment.id, companyId) (línea 127)
│
└── 7. Retorna payment
```

#### Método `update(id, companyId, dto)` — línea 141

Se usa para actualizar estado, ej: marcar como PAID.

```
PATCH /api/v1/payments/:id
│
├── 1. Si cambia a PAID (línea 160):
│   ├── payment.paidAmount = totalAmount
│   ├── payment.paidAt = new Date()
│   ├── Si Debt existe → debt.status = PAID, debt.paidAt = now
│   ├── CashMovement (INCOME) si no existe ya
│   └── async: generateAndStoreReceipt() si no hay cloudinaryUrl
│
├── 2. Si cambia a DEFERRED (línea 179):
│   └── Crear Debt
│
└── 3. Si método cambia a MP_QR/MP_CHECKOUT y no tiene mpAccessToken → error 400
```

#### `handleWebhook(query)` — línea 232

Maneja webhooks de MP para pagos de clientes. Delega a `MercadopagoService.handleWebhook()`.

---

## 5. Flujo de Compra de Insumos

### Endpoint

```
POST /api/v1/supply-purchases
```

### Controlador

`src/supply-purchases/supply-purchases.controller.ts` — `SupplyPurchasesController`
- Método: `create()` (línea 19)

### Servicio

`src/supply-purchases/supply-purchases.service.ts` — `SupplyPurchasesService`

#### Método `create(companyId, dto)` — línea estimada

```
POST /api/v1/supply-purchases
│
├── 1. Validar Supply existe y pertenece a company
├── 2. totalCost = quantity * unitCost
├── 3. Crear SupplyPurchase (supplyId, quantity, unitCost, totalCost, supplier, invoiceNum)
├── 4. Incrementar stock: Supply.quantity += quantity
├── 5. CashMovement (EXPENSE) por totalCost
│   └── cashService.create(companyId, { type: 'EXPENSE', amount: totalCost, reason: "Compra de {supply.name}" })
└── 6. Retorna purchase
```

**⚠️ No genera ningún documento PDF.** Solo registro en DB + movimiento de caja.

### Tablas DB afectadas

| Tabla | Acción |
|-------|--------|
| `SupplyPurchase` | INSERT |
| `Supply` | UPDATE `quantity += quantity` |
| `CashMovement` | INSERT (tipo EXPENSE) |

---

## 6. Flujo de Gastos y Ajustes de Stock

### Gastos manuales

```
POST /api/v1/cash-register
```

**Controlador:** `src/cash-register/cash-register.controller.ts` — `CashRegisterController`
- Método: `create()` (línea 27)

**Servicio:** `src/cash-register/cash-register.service.ts` — `CashRegisterService`

Crea un `CashMovement` con `type: EXPENSE` o `INCOME`. Reason libre.

### Ajustes de stock

- **Decremento manual:** `POST /api/v1/supplies/:id/decrease` — `SuppliesController` (línea 59)
  - Desc. stock, emite alerta si low stock
- **Update manual:** `PATCH /api/v1/supplies/:id` — puede modificar `quantity` directamente
- **Alta inicial:** `POST /api/v1/supplies` — crea Supply con `quantity` inicial

### Alerta de stock bajo

En `SuppliesService.decreaseStock()`: después de decrementar, si `quantity <= minQuantity`, emite evento `stock:alert` vía WebSocket a todos los usuarios de la compañía.

---

## 7. Visualización y Descarga de Documentos

| Documento | Descargar PDF | Ver URL Cloudinary |
|-----------|--------------|-------------------|
| **Recibo** | `GET /api/v1/payments/:id/receipt` → `PaymentsController.generateReceipt()` (línea 36) | ❌ No existe endpoint público |
| **Receta** | `GET /api/v1/medical-records/:id/pdf` → `MedicalRecordsController.getPrescriptionPdf()` (línea 47) | `GET /api/v1/medical-records/:id/prescription/url` → `MedicalRecordsController.getPrescriptionUrl()` (línea 64) |
| **Historia Clínica** | `GET /api/v1/pets/:id/document` → `PdfController.getPetDocument()` (línea 15) | No se almacena |
| **Historia Clínica** | `GET /api/v1/pets/:id/medical-history/pdf` → `PetsController` (línea 78) | No se almacena |

### ¿Dónde están las URLs de los documentos persistidos?

- **Recibo:** `Payment.cloudinaryUrl` — se setea en `PdfService.generateAndStoreReceipt()` (línea 427)
- **Receta:** `Document` con `type: 'EXPORT_PDF'`, `relatedEntity: 'MedicalRecord'`, `relatedEntityId: recordId`

### Detalle de generación bajo demanda

#### `GET /api/v1/payments/:id/receipt`

1. `PaymentsController.generateReceipt()` (línea 36) llama a `paymentsService.generateReceipt()`
2. `PaymentsService.generateReceipt()` (línea 228) llama a `pdfService.generateReceipt(paymentId, companyId)`
3. `PdfService.generateReceipt()` (línea 87):
   - Busca Payment + Client + PaymentItem[] + Company en DB
   - Renderiza `receipt.hbs` con Handlebars
   - Genera PDF con Puppeteer
   - Retorna Buffer (no persiste)
4. Controller envía Buffer como `application/pdf`

#### `GET /api/v1/medical-records/:id/pdf`

1. `MedicalRecordsController.getPrescriptionPdf()` (línea 47)
2. Opcionalmente llama a `MedicalRecordsService.generateAndStorePrescription()` (línea 387)
3. Que a su vez llama a `PdfService.generateAndStorePrescription()` (línea 256):
   - Busca MedicalRecord + Pet + Client + Prescription[] + Company en DB
   - Renderiza `prescription.hbs`
   - Genera PDF
   - **Sube a Cloudinary**
   - **Crea Document** con type EXPORT_PDF
4. Retorna Buffer al cliente

#### `GET /api/v1/medical-records/:id/prescription/url`

1. `MedicalRecordsController.getPrescriptionUrl()` (línea 64)
2. Busca Document existente con `type: EXPORT_PDF, relatedEntity: 'MedicalRecord'`
3. Si no existe → genera uno nuevo via `generateAndStorePrescription()`
4. Retorna `{ url: cloudinaryUrl }`

---

## 8. Endpoints por Controlador

### PaymentsController (`src/payments/payments.controller.ts`)

Ruta base: `api/v1/payments`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/` | `findAll` | Listar pagos (filtrable) |
| POST | `/` | `create` | Crear pago directo (compra sin consulta) |
| GET | `/:id` | `findOne` | Ver detalle de pago |
| PATCH | `/:id` | `update` | Actualizar pago (cambiar estado, método) |
| DELETE | `/:id` | `remove` | Soft delete |
| POST | `/:id/checkout` | `generateCheckoutLink` | Crear link de MP para pago |
| GET | `/:id/receipt` | `generateReceipt` | Descargar recibo PDF |
| POST | `/webhook` | `handleWebhook` | Webhook público de MP |

### MedicalRecordsController (`src/medical-records/medical-records.controller.ts`)

Ruta base: `api/v1/medical-records`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/` | `findAll` | Listar consultas |
| POST | `/` | `create` | Crear consulta + pago + documentos |
| GET | `/:id` | `findOne` | Detalle de consulta |
| PATCH | `/:id` | `update` | Actualizar consulta |
| DELETE | `/:id` | `remove` | Soft delete |
| POST | `/:id/procedures` | `addProcedure` | Agregar procedimiento |
| POST | `/:id/prescriptions` | `addPrescription` | Agregar prescripción |
| GET | `/:id/pdf` | `getPrescriptionPdf` | Descargar receta PDF |
| GET | `/:id/prescription/url` | `getPrescriptionUrl` | Obtener URL de receta en Cloudinary |

### PdfController (`src/documents/pdf.controller.ts`)

Ruta base: `api/v1/pets`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/:id/document` | `getPetDocument` | Descargar historia clínica PDF |

### SupplyPurchasesController (`src/supply-purchases/supply-purchases.controller.ts`)

Ruta base: `api/v1/supply-purchases`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/` | `findAll` | Listar compras |
| POST | `/` | `create` | Registrar compra de insumo |
| GET | `/export` | `exportXlsx` | Exportar a Excel |

### CashRegisterController (`src/cash-register/cash-register.controller.ts`)

Ruta base: `api/v1/cash-register`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/` | `findAll` | Listar movimientos |
| GET | `/summary` | `getSummary` | Resumen ingresos/gastos/saldo |
| POST | `/` | `create` | Crear movimiento manual |
| PATCH | `/:id` | `update` | Editar (solo si no ligado a payment) |
| DELETE | `/:id` | `remove` | Eliminar (solo si no ligado a payment) |

### SuppliesController (`src/supplies/supplies.controller.ts`)

Ruta base: `api/v1/supplies`

| Método | Endpoint | Handler | Descripción |
|--------|----------|---------|-------------|
| GET | `/` | `findAll` | Listar insumos (con filtro lowStock) |
| GET | `/low-stock` | `lowStock` | Insumos con stock bajo |
| GET | `/template` | `downloadTemplate` | Template para importación Excel |
| GET | `/export` | `exportXlsx` | Exportar insumos a Excel |
| POST | `/import` | `importXlsx` | Importar insumos desde Excel |
| GET | `/:id` | `findOne` | Detalle de insumo |
| POST | `/` | `create` | Crear insumo |
| PATCH | `/:id` | `update` | Actualizar insumo |
| DELETE | `/:id` | `remove` | Eliminar insumo |
| POST | `/:id/decrease` | `decreaseStock` | Decrementar stock manualmente |

---

## 9. Diagrama de Entidades

```
Company
  │
  ├── Payment  ──── PaymentItem[]   (itemType: 'PROCEDURE' | 'SUPPLY')
  │     │              │
  │     │              └── supplyId → Supply (descuenta stock)
  │     │
  │     ├── CashMovement  (INCOME si PAID)
  │     ├── Debt          (si DEFERRED o método no confirmado)
  │     ├── Document      (PAYMENT_RECEIPT, en Cloudinary)
  │     └── MedicalRecord (1:1 @unique via medicalRecordId)
  │
  ├── MedicalRecord ──── Procedure[] ──── Supply (descuenta stock)
  │     │                  │
  │     │                  └── PriceItem (precio de referencia)
  │     │
  │     ├── Prescription[] ──── Supply (descuenta stock si soldInClinic)
  │     └── Payment (1:1)
  │
  ├── SupplyPurchase ──── Supply (incrementa stock)
  │     └── CashMovement (EXPENSE)
  │
  ├── CashMovement (INGRESO o GASTO)
  ├── Supply (inventario con stock, precio venta, unidades por envase)
  ├── Debt (deuda de cliente, con interés)
  ├── Document (PDFs: recibos, recetas, exportaciones)
  └── PriceItem (catálogo de precios de procedimientos)
```

---

## 10. Oportunidades de Mejora

1. **URL pública del recibo:** No existe `GET /api/v1/payments/:id/receipt/url` (existe para recetas pero no para recibos). Para obtener la URL de Cloudinary de un recibo, actualmente solo se puede acceder via `Payment.cloudinaryUrl` en DB.

2. **Comprobante de compra:** Al comprar insumos (`POST /api/v1/supply-purchases`) no se genera ningún PDF. Solo queda el registro en `SupplyPurchase` y el `CashMovement` de egreso.

3. **Factura fiscal:** El comprobante actual (`receipt.hbs`) dice explícitamente "Este documento no tiene validez fiscal. Uso interno." No hay integración con AFIP para factura electrónica.

4. **Generación asíncrona sin cola:** Los PDFs se generan con promesas sin `await` (fire-and-forget). Si Puppeteer falla, el error se traga. Podría implementarse una cola con Bull/BullMQ para reintentos y monitoreo.

5. **Puppeteer en producción:** Al usar Puppeteer para generar PDFs, cada llamada lanza un Chromium headless. Para alto volumen, considerar:
   - Pool de navegadores
   - O alternativa más liviana como `pdfkit` o `jsreport`
   - Asegurar que `--no-sandbox` está configurado en producción
