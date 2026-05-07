# PataSoft — Guía de Instalación Local (Sin Docker)

## Requisitos Previos

- Node.js 18+
- Python 3.10+ (para AI Service)
- PostgreSQL 15+ con extensión pgvector
- Redis 7+

---

## 1. Instalación de Infraestructura

### Ubuntu/Debian

```bash
# PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Habilitar y crear usuario
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER patasoft WITH PASSWORD 'patasoft_dev';"
sudo -u postgres psql -c "CREATE DATABASE patasoft_db OWNER patasoft;"
sudo -u postgres psql -c "ALTER USER patasoft CREATEDB;"

# Instalar extensión pgvector
sudo apt install -y postgresql-15-pgvector
sudo -u postgres psql -d patasoft_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### macOS (Homebrew)

```bash
# PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Crear usuario y base de datos
createuser -s patasoft
createdb -O patasoft patasoft_db

# Redis
brew install redis
brew services start redis
```

### Windows (WSL2 recomendado)

```bash
# En WSL2 Ubuntu
sudo apt update
sudo apt install -y postgresql redis-server
```

---

## 2. Configuración de Variables de Entorno

Las variables ya están configuradas en `backend/.env`. Verifica que los valores sean correctos:

```bash
# Base de datos
DATABASE_URL=postgresql://patasoft:patasoft_dev@localhost:5432/patasoft_db

# Redis
REDIS_URL=redis://localhost:6379

# AI Service
AI_SERVICE_URL=http://localhost:8000
```

---

## 3. Instalación de Dependencias

### Backend (Terminal 1)

```bash
cd backend

# Instalar dependencias Node.js
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor
npm run start:dev
```

El backend estará disponible en: `http://localhost:3000`

### Frontend (Terminal 2)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev
```

El frontend estará disponible en: `http://localhost:4321`

### AI Service (Python) (Terminal 3)

```bash
cd ai-service

# Crear entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\Activate.ps1  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

El AI Service estará disponible en: `http://localhost:8000`

---

## 4. Verificación

### Verificar PostgreSQL

```bash
psql -U patasoft -d patasoft_db -c "SELECT version();"
```

### Verificar Redis

```bash
redis-cli ping
# Debe responder: PONG
```

### Verificar servicios

```bash
# Backend
curl http://localhost:3000

# Frontend
curl http://localhost:4321

# AI Service
curl http://localhost:8000/docs
```

---

## 5. Troubleshooting

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Ver credenciales en pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

### Error de conexión a Redis

```bash
# Verificar que Redis esté corriendo
redis-cli ping

# Ver configuración
redis-cli CONFIG GET maxmemory
```

### Error de pgvector

```bash
# Instalar manualmente
sudo -u postgres psql -d patasoft_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Comandos Útiles

```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Reiniciar Redis
sudo systemctl restart redis-server

# Ver logs del backend
cd backend && npm run start:dev

# Regenerar Prisma
cd backend && npx prisma generate
```