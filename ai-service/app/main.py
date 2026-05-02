import os
import sys
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

def validate_environment():
    """Valida que las variables críticas estén presentes antes de arrancar"""
    missing = []
    
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key or groq_key == "dev_groq_key":
        missing.append("GROQ_API_KEY")
    
    # Verificar conexión con Chroma/persist directory
    chroma_path = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    try:
        os.makedirs(chroma_path, exist_ok=True)
        test_file = os.path.join(chroma_path, ".health_check")
        with open(test_file, 'w') as f:
            f.write("health")
        os.remove(test_file)
        print(f"[OK] Chroma persist directory accessible: {chroma_path}")
    except Exception as e:
        print(f"[ERROR] No se puede escribir en Chroma persist directory: {e}")
        sys.exit(1)
    
    if missing:
        print(f"[ERROR] Faltan variables de entorno críticas: {', '.join(missing)}")
        print("[ERROR] El servicio no puede iniciar sin estas variables")
        sys.exit(1)
    
    print(f"[OK] Environment validation passed")

validate_environment()

app = FastAPI(
    title="PataSoft AI Service",
    description="AI Service para PataSoft - Gestión Veterinaria",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import chat, transcription, rag, company
from app import tools, memory

app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(transcription.router, prefix="/api/v1/transcription", tags=["transcription"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["rag"])
app.include_router(company.router, prefix="/api/v1/company", tags=["company"])


@app.get("/health")
def health_check():
    try:
        # Verificar Chroma
        from app.api.rag import get_embeddings, CHROMA_PATH
        embeddings = get_embeddings()
        return {
            "status": "ok", 
            "service": "ai",
            "chromadb": "connected",
            "chromadb_path": CHROMA_PATH
        }
    except Exception as e:
        return {"status": "degraded", "service": "ai", "error": str(e)}


@app.get("/")
def root():
    return {"message": "PataSoft AI Service", "version": "1.0.0"}