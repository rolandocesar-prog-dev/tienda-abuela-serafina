"""
Authentication Service — exigido por el PDF (compartido).

Responsabilidades:
- JWT (emisión y validación)
- Usuarios + Roles: Administrador, Cajero, Supervisor, Gerente

Importante: este servicio también debe publicar un middleware reutilizable
para que los otros 6 servicios validen el JWT (ver docs/HANDOFF.md sección 3).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


# TODO(owner-auth): implementar.


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def registrar(payload: dict, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/login")
async def login(payload: dict, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/me")
async def perfil() -> dict:
    raise HTTPException(status_code=501, detail="No implementado")
