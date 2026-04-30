# PataSoft - Progreso de Implementacion v2
Fecha: 2026-04-30
Estado: COMPLETADO ✅

## Builds
- Frontend (vite build): ✅ sin errores (198.78 kB)
- Backend (tsc --noEmit --skipLibCheck): ✅ exit code 0

## Archivos Modificados
- `frontend/src/pages/dashboard.jsx` - Todas las fases
- `backend/src/cash-register/dto/cash-movement.dto.ts` - Fase 6
- `backend/src/cash-register/cash-register.service.ts` - Fase 6

## Resumen de Cambios (Sesión 2)

### Fix API paths (Issues 1, 2, 3, 4, 5)
- `api.get('/companies/config')` → `api.get('/companies/me/config')`
- `api.put('/companies/config')` → `api.patch('/companies/me/config')`
- `api.put('/companies')` → `api.patch('/companies/me')`
- `businessName` → `legalName` (campo correcto del modelo Prisma)
- MercadoPago: reescrito con OAuth flow (connect/status/disconnect)
- AI settings: fallback graceful cuando servicio IA caido, `documents_count` → `documentsCount`
- Prices: botón "Nuevo Precio" conectado + edit/delete + search + paginación

### Payments/Cobros (Issues 6, 7, 8)
- Renombrado "Pagos" → "Cobros", "Nuevo Pago" → "Nuevo Cobro"
- Items con autocomplete desde tabla supplies (search + auto-fill precio)
- Botón "Crear cliente ocasional" inline (nombre, DNI/CUIL, teléfono)
- Tabla cobros: botones marcar pagado (+) y eliminar (X)
- Tabla deudas: botones pagar y cancelar (endpoints correctos: /debts/:id/pay, /debts/:id/cancel)

### Consulta (Issues 9, 10, 11)
- Prescripciones médicas SEPARADAS de insumos:
  - Prescripciones: medicina, dosis, unidad, frecuencia, duración (puro médico)
  - Insumos/Cobrar: search autocomplete desde supplies, precio, cantidad, subtotal
  - Procedimientos: autocomplete desde price-items configurados
- Select mascota muestra dueño: "Nombre (Nombre Dueño)" o "Nombre (Sin dueño)"
- Total estimado calculado en vivo desde procedimientos + insumos

### Mascotas (Issue 14)
- Tabla mascotas: muestra dueño, sin dueño si es callejera
- Botón "Ver" → modal con datos completos + fotos
- Botón "Eliminar" con confirmación
- Subir foto: botón en modal detalle, sube a /pets/:id/photos
- Eliminar foto: botón X en cada foto
- Paginación corregida con `totalPages > 1`

### Clientes (Issue 14)
- Modal detalle cliente: muestra datos + mascotas del cliente
- Carga dinámica de mascotas desde /clients/:id/pets

### Items NO implementados (requieren más trabajo)
- Subida de fotos en consulta (max 5 por mascota por consulta)
- Detalle mascota con historial de consultas
- Mejora del flujo de subscripción con MercadoPago developer
