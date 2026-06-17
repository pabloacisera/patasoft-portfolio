#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

zip -r _app.zip . \
-x ".git/*" \
-x ".git" \
\
-x "*/node_modules/*" \
-x "*/node_modules" \
-x "*/venv/*" \
-x "*/venv" \
-x "*/__pycache__/*" \
-x "*/__pycache__" \
-x "*/.pytest_cache/*" \
-x "*/.pytest_cache" \
\
-x "*/dist/*" \
-x "*/dist" \
-x "*/build/*" \
-x "*/build" \
\
-x "*/playwright-report/*" \
-x "*/playwright-report" \
-x "*/test-results/*" \
-x "*/test-results" \
\
-x "docker/postgres-data/*" \
-x "docker/postgres-data" \
-x "docker/redis-data/*" \
-x "docker/redis-data" \
\
-x "*/uploads/*" \
-x "*/uploads" \
\
-x "logs/*" \
-x "logs" \
\
-x "ai-service/chroma_db/*" \
-x "ai-service/chroma_db" \
-x "ai-service/chroma_data/*" \
-x "ai-service/chroma_data" \
\
-x "*.log" \
-x "*.pyc" \
-x "*.webm" \
-x "*.png" \
\
-x ".env" \
-x "*/.env" \
-x ".env.local" \
-x "*/.env.local" \
\
-x "_app.zip"
