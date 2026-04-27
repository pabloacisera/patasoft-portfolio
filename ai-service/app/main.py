import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

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
    return {"status": "ok", "service": "ai"}


@app.get("/")
def root():
    return {"message": "PataSoft AI Service", "version": "1.0.0"}