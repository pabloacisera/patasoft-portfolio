import os
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field
from langchain.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://patasoft:patasoft_dev@localhost:5432/patasoft_db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PetsInput(BaseModel):
    company_id: str = Field(..., description="ID de la empresa/veterinaria")
    name: Optional[str] = Field(None, description="Nombre de la mascota a buscar")
    species: Optional[str] = Field(None, description="Especie: dog, cat, horse, bird, rabbit, reptile, other")
    client_id: Optional[str] = Field(None, description="ID del cliente/dueño")
    limit: int = Field(20, description="Límite de resultados")


class GetPetsTool(BaseTool):
    name = "get_pets"
    description = """Busca mascotas de la empresa. 
    - company_id: ID de la empresa (requerido)
    - name: nombre parcial o completo de la mascota
    - species: especie (dog, cat, horse, bird, rabbit, reptile, other)
    - client_id: filtra por cliente específico
    Returns hasta 20 mascotas con sus datos básicos."""

    args_schema: Type[BaseModel] = PetsInput

    def _run(
        self,
        company_id: str,
        name: Optional[str] = None,
        species: Optional[str] = None,
        client_id: Optional[str] = None,
        limit: int = 20,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        db = next(get_db())
        try:
            query = """
                SELECT p.id, p.name, p.species, p.breed, p.gender, p.is_neutered, p.notes,
                       c.id as client_id, c.name as client_name, c.last_name as client_last_name
                FROM "Pet" p
                LEFT JOIN "Client" c ON p."clientId" = c.id
                WHERE p."companyId" = :company_id
            """
            params = {"company_id": company_id, "limit": limit}

            if name:
                query += " AND LOWER(p.name) LIKE LOWER(:name)"
                params["name"] = f"%{name}%"
            if species:
                query += " AND p.species = :species"
                params["species"] = species
            if client_id:
                query += " AND p.\"clientId\" = :client_id"
                params["client_id"] = client_id

            query += " ORDER BY p.name LIMIT :limit"
            params["limit"] = limit

            result = db.execute(text(query), params)
            pets = []
            for row in result:
                pets.append({
                    "id": row.id,
                    "name": row.name,
                    "species": row.species,
                    "breed": row.breed,
                    "gender": row.gender,
                    "is_neutered": row.is_neutered,
                    "notes": row.notes,
                    "client": {
                        "id": row.client_id,
                        "name": row.client_name,
                        "last_name": row.client_last_name,
                    } if row.client_id else None,
                })

            return {"success": True, "count": len(pets), "pets": pets}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            db.close()


class GetClientsInput(BaseModel):
    company_id: str = Field(..., description="ID de la empresa")
    name: Optional[str] = Field(None, description="Nombre a buscar")
    email: Optional[str] = Field(None, description="Email a buscar")
    dni: Optional[str] = Field(None, description="DNI a buscar")
    limit: int = Field(20, description="Límite de resultados")


class GetClientsTool(BaseTool):
    name = "get_clients"
    description = """Busca clientes de la empresa.
    - company_id: ID de la empresa (requerido)
    - name: nombre o apellido parcial
    - email: email parcial o completo
    - dni: DNI exacto
    Returns hasta 20 clientes."""

    args_schema: Type[BaseModel] = GetClientsInput

    def _run(
        self,
        company_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        dni: Optional[str] = None,
        limit: int = 20,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        db = next(get_db())
        try:
            query = """
                SELECT id, name, last_name, dni, email, phone, address, is_company, notes
                FROM "Client"
                WHERE "companyId" = :company_id
            """
            params = {"company_id": company_id, "limit": limit}

            if name:
                query += " AND (LOWER(name) LIKE LOWER(:name) OR LOWER(last_name) LIKE LOWER(:name))"
                params["name"] = f"%{name}%"
            if email:
                query += " AND LOWER(email) LIKE LOWER(:email)"
                params["email"] = f"%{email}%"
            if dni:
                query += " AND dni = :dni"
                params["dni"] = dni

            query += " ORDER BY name, last_name LIMIT :limit"

            result = db.execute(text(query), params)
            clients = []
            for row in result:
                clients.append({
                    "id": row.id,
                    "name": row.name,
                    "last_name": row.last_name,
                    "dni": row.dni,
                    "email": row.email,
                    "phone": row.phone,
                    "address": row.address,
                    "is_company": row.is_company,
                    "notes": row.notes,
                })

            return {"success": True, "count": len(clients), "clients": clients}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            db.close()


class GetMedicalRecordsInput(BaseModel):
    pet_id: str = Field(..., description="ID de la mascota")
    limit: int = Field(10, description="Límite de registros (default 10)")


class GetMedicalRecordsTool(BaseTool):
    name = "get_medical_records"
    description = """Obtiene el historial médico de una mascota.
    - pet_id: ID de la mascota (requerido)
    - limit: número de registros (default 10, máximo 50)
    Returns el historial con fecha, motivo, diagnóstico y tratamiento."""

    args_schema: Type[BaseModel] = GetMedicalRecordsInput

    def _run(
        self,
        pet_id: str,
        limit: int = 10,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        db = next(get_db())
        try:
            limit = min(limit, 50)
            
            query = """
                SELECT id, date, visit_reason, diagnosis, treatment, observations, 
                       weight, temperature, next_visit_date
                FROM "MedicalRecord"
                WHERE "petId" = :pet_id
                ORDER BY date DESC
                LIMIT :limit
            """
            result = db.execute(text(query), {"pet_id": pet_id, "limit": limit})
            records = []
            for row in result:
                records.append({
                    "id": row.id,
                    "date": row.date.isoformat() if row.date else None,
                    "visit_reason": row.visit_reason,
                    "diagnosis": row.diagnosis,
                    "treatment": row.treatment,
                    "observations": row.observations,
                    "weight": row.weight,
                    "temperature": row.temperature,
                    "next_visit_date": row.next_visit_date.isoformat() if row.next_visit_date else None,
                })

            query_count = text('SELECT COUNT(*) as total FROM "MedicalRecord" WHERE "petId" = :pet_id')
            total = db.execute(query_count, {"pet_id": pet_id}).scalar()

            return {
                "success": True,
                "count": len(records),
                "total": total,
                "records": records,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            db.close()


class GetSuppliesInput(BaseModel):
    company_id: str = Field(..., description="ID de la empresa")
    name: Optional[str] = Field(None, description="Nombre a buscar")
    category: Optional[str] = Field(None, description="Categoría: medicine, equipment, consumable, other")
    low_stock: bool = Field(False, description="Filtrar solo insumos con stock bajo")


class GetSuppliesTool(BaseTool):
    name = "get_supplies"
    description = """Busca insumos del stock de la empresa.
    - company_id: ID de la empresa (requerido)
    - name: nombre parcial
    - category: medicine, equipment, consumable, other
    - low_stock: true para ver solo los que tienen stock bajo el mínimo
    Returns lista de insumos con cantidades y precios."""

    args_schema: Type[BaseModel] = GetSuppliesInput

    def _run(
        self,
        company_id: str,
        name: Optional[str] = None,
        category: Optional[str] = None,
        low_stock: bool = False,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        db = next(get_db())
        try:
            query = """
                SELECT id, name, brand, category, unit, quantity, min_quantity, unit_price, expires_at
                FROM "Supply"
                WHERE "companyId" = :company_id AND "isActive" = true
            """
            params = {"company_id": company_id}

            if name:
                query += " AND LOWER(name) LIKE LOWER(:name)"
                params["name"] = f"%{name}%"
            if category:
                query += " AND category = :category"
                params["category"] = category
            if low_stock:
                query += " AND quantity <= COALESCE(min_quantity, initial_qty * 0.1)"

            query += " ORDER BY name"

            result = db.execute(text(query), params)
            supplies = []
            for row in result:
                min_qty = row.min_quantity or 0
                is_low = row.quantity <= min_qty if min_qty > 0 else row.quantity == 0
                supplies.append({
                    "id": row.id,
                    "name": row.name,
                    "brand": row.brand,
                    "category": row.category,
                    "unit": row.unit,
                    "quantity": row.quantity,
                    "min_quantity": row.min_quantity,
                    "low_stock": is_low,
                    "unit_price": float(row.unit_price) if row.unit_price else 0,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                })

            return {"success": True, "count": len(supplies), "supplies": supplies}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            db.close()


class GetDebtsInput(BaseModel):
    company_id: str = Field(..., description="ID de la empresa")
    status: Optional[str] = Field(None, description="Estado: PENDING, PAID, OVERDUE")
    client_name: Optional[str] = Field(None, description="Nombre del cliente")


class GetDebtsTool(BaseTool):
    name = "get_debts"
    description = """Busca deudas pendientes de la empresa.
    - company_id: ID de la empresa (requerido)
    - status: PENDING, PAID, OVERDUE
    - client_name: nombre del cliente a buscar
    Returns lista de deudas con montos y fechas de vencimiento."""

    args_schema: Type[BaseModel] = GetDebtsInput

    def _run(
        self,
        company_id: str,
        status: Optional[str] = None,
        client_name: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        db = next(get_db())
        try:
            query = """
                SELECT d.id, d.amount, d.status, d.due_date, d.paid_at,
                       c.id as client_id, c.name as client_name, c.last_name as client_last_name
                FROM "Debt" d
                JOIN "Client" c ON d."clientId" = c.id
                WHERE d."companyId" = :company_id
            """
            params = {"company_id": company_id}

            if status:
                query += " AND d.status = :status"
                params["status"] = status
            else:
                query += " AND d.status IN ('PENDING', 'OVERDUE')"

            if client_name:
                query += " AND LOWER(c.name) LIKE LOWER(:client_name)"
                params["client_name"] = f"%{client_name}%"

            query += " ORDER BY d.due_date"

            result = db.execute(text(query), params)
            debts = []
            for row in result:
                debts.append({
                    "id": row.id,
                    "amount": float(row.amount),
                    "status": row.status,
                    "due_date": row.due_date.isoformat() if row.due_date else None,
                    "paid_at": row.paid_at.isoformat() if row.paid_at else None,
                    "client": {
                        "id": row.client_id,
                        "name": row.client_name,
                        "last_name": row.client_last_name,
                    },
                })

            total_pending = sum(d["amount"] for d in debts if d["status"] in ("PENDING", "OVERDUE"))

            return {
                "success": True,
                "count": len(debts),
                "total_pending": total_pending,
                "debts": debts,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            db.close()


get_pets_tool = GetPetsTool()
get_clients_tool = GetClientsTool()
get_medical_records_tool = GetMedicalRecordsTool()
get_supplies_tool = GetSuppliesTool()
get_debts_tool = GetDebtsTool()

__all__ = [
    "get_pets_tool",
    "get_clients_tool",
    "get_medical_records_tool",
    "get_supplies_tool",
    "get_debts_tool",
]