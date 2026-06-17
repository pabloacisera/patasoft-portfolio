from fastapi import APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
import os

load_dotenv()

router = APIRouter()

MAX_FILE_SIZE = 25 * 1024 * 1024

@router.post("")
async def transcribe(file: UploadFile = File(...)):
    try:
        if not file.content_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail="El archivo debe ser de audio")
        
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo de 25MB")
        
        import tempfile
        from openai import OpenAI
        
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            with open(tmp_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            return {"text": response}
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))