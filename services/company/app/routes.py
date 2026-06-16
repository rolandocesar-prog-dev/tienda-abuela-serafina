"""
Company Service — compartido (puede ser provisto por el docente).

Verificar con el docente si lo implementa él. Si sí, este servicio se borra.

Endpoints sugeridos:
- POST   /companies
- GET    /companies
- GET    /companies/{id}
- POST   /companies/{id}/branches
- GET    /companies/{id}/branches
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/companies", tags=["companies"])


# TODO(owner-company): implementar.


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_company(payload: dict, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("")
async def listar_companies(db: AsyncSession = Depends(get_db)) -> list[dict]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{company_id}")
async def obtener_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/{company_id}/branches", status_code=status.HTTP_201_CREATED)
async def crear_branch(
    company_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{company_id}/branches")
async def listar_branches(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[dict]:
    raise HTTPException(status_code=501, detail="No implementado")
