import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document as LangchainDocument

load_dotenv()

router = APIRouter()

class Document(BaseModel):
    id: Optional[str] = None
    content: str
    metadata: Optional[dict] = None

class AddDocumentsRequest(BaseModel):
    documents: List[Document]
    companyId: str

class QueryRequest(BaseModel):
    query: str
    companyId: str
    top_k: int = 5

class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]

# Directorio persistente para Chroma
CHROMA_PATH = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")

# Memoria en runtime para vectorstores
vectorstores = {}

def get_embeddings():
    emb_model = os.getenv("EMBEDDINGS_MODEL", "gemini-embedding-001")
    if "gemini" in emb_model:
        return GoogleGenerativeAIEmbeddings(model=emb_model)
    return OpenAIEmbeddings(model="text-embedding-3-small")

def get_collection_name(companyId: str) -> str:
    """genera nombre de colección único por empresa - AISLAMIENTO PRIVADO"""
    return f"company_{companyId}"

def get_vectorstore(companyId: str, embeddings=None):
    """Obtiene o crea un vectorstore para una empresa específica"""
    if embeddings is None:
        embeddings = get_embeddings()
    
    collection_name = get_collection_name(companyId)
    
    # Si ya existe en memoria, retornarlo
    if companyId in vectorstores:
        return vectorstores[companyId]
    
    # Intentar cargar desde disco persistente
    try:
        vs = Chroma(
            client=Chroma.extract_file_path(CHROMA_PATH),
            collection_name=collection_name,
            embedding_function=embeddings,
        )
        vectorstores[companyId] = vs
        return vs
    except:
        pass
    
    # Crear nuevo si no existe
    vs = Chroma.from_documents(
        documents=[],
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_PATH,
    )
    vectorstores[companyId] = vs
    return vs


@router.post("/documents")
async def add_documents(request: AddDocumentsRequest):
    """
    Agrega documentos al RAG de una empresa específica.
    PRIVACIDA: cada empresa tiene su propia colección aislada.
    """
    try:
        company_id = request.companyId
        
        # VALIDACIÓN DE PRIVACIA: companyId es obligatorio
        if not company_id:
            raise HTTPException(status_code=400, detail="companyId es requerido")
        
        embeddings = get_embeddings()
        
        texts = [doc.content for doc in request.documents]
        metadatas = [doc.metadata or {} for doc in request.documents]
        
        # Agregar companyId a metadata para doble verificación
        for meta in metadatas:
            meta["companyId"] = company_id
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = text_splitter.create_documents(texts, metadatas=metadatas)
        
        # Usar colección aislada por empresa
        collection_name = get_collection_name(company_id)
        
        vs = Chroma.from_documents(
            documents=docs,
            embedding=embeddings,
            collection_name=collection_name,
            persist_directory=CHROMA_PATH,
        )
        
        # Guardar en memoria para rápido acceso
        vectorstores[company_id] = vs
        
        return {
            "added": len(request.documents), 
            "message": f"Documentos guardados para empresa {company_id}",
            "collection": collection_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Consulta el RAG de una empresa específica.
    PRIVACIDAD: solo retorna documentos de esa empresa.
    """
    try:
        company_id = request.companyId
        
        # VALIDACIÓN DE PRIVACIDAD
        if not company_id:
            raise HTTPException(status_code=400, detail="companyId es requerido")
        
        # Obtener vectorstore de esta empresa específica
        embeddings = get_embeddings()
        collection_name = get_collection_name(company_id)
        
        try:
            vs = Chroma(
                collection_name=collection_name,
                embedding_function=embeddings,
                persist_directory=CHROMA_PATH,
            )
        except:
            vs = None
        
        if not vs:
            return QueryResponse(
                answer="No hay documentos cargados para esta empresa. Sincronizá tus datos desde Configuración > IA.",
                sources=[]
            )
        
        # Buscar SOLO en documentos de esta empresa
        docs = vs.similarity_search(request.query, k=request.top_k)
        
        # Filtrar por companyId en metadata (doble validación) - CRÍTICO
        docs = [d for d in docs if d.metadata.get("companyId") == company_id]
        
        if not docs:
            return QueryResponse(
                answer="No hay documentos relevantes encontrados.",
                sources=[]
            )
        
        context = "\n\n".join([d.page_content for d in docs])
        
        prompt = f"""Eres un asistente veterinario. Basándote EXCLUSIVAMENTE en los siguientes documentos de esta empresa, responde la pregunta.

Documentos:
{context}

Pregunta: {request.query}

Respuesta:"""
        
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o", openai_api_key=os.getenv("OPENAI_API_KEY", ""))
        
        response = llm.invoke(prompt)
        
        return QueryResponse(
            answer=response.content,
            sources=[{"content": d.page_content[:300], "metadata": d.metadata} for d in docs]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{companyId}")
async def delete_documents(companyId: str):
    """
    Elimina todos los documentos de una empresa.
    PRIVACIDA:solo elimina los de esa empresa.
    """
    try:
        if companyId in vectorstores:
            del vectorstores[companyId]
        
        collection_name = get_collection_name(companyId)
        
        # Eliminar colección persistente
        try:
            vs = Chroma(
                collection_name=collection_name,
                embedding_function=get_embeddings(),
                persist_directory=CHROMA_PATH,
            )
            vs.delete_collection()
        except:
            pass
        
        return {"deleted": True, "companyId": companyId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{companyId}")
async def get_rag_status(companyId: str):
    """
    Obtiene el estado del RAG de una empresa.
    PRIVACIDA: solo muestra datos de esa empresa.
    """
    try:
        collection_name = get_collection_name(companyId)
        
        try:
            vs = Chroma(
                collection_name=collection_name,
                embedding_function=get_embeddings(),
                persist_directory=CHROMA_PATH,
            )
            count = vs._collection.count()
        except:
            count = 0
        
        return {
            "companyId": companyId,
            "collection": collection_name,
            "documents_count": count,
            "status": "ready" if count > 0 else "empty"
        }
    except Exception as e:
        return {
            "companyId": companyId,
            "status": "error",
            "error": str(e)
        }