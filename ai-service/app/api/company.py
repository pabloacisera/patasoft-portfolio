from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

class AIModelConfig(BaseModel):
    model: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None

class CompanyConfigRequest(BaseModel):
    companyId: str
    model: AIModelConfig


@router.get("/{companyId}")
async def get_company_config(companyId: str):
    return {
        "companyId": companyId,
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.7
    }


@router.put("/{companyId}")
async def update_company_config(companyId: str, config: CompanyConfigRequest):
    return {"companyId": companyId, "model": config.model.model, "updated": True}