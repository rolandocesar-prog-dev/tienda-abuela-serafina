"""
Customer Service — endpoints exigidos por el PDF (Equipo 4).

Endpoints:
- POST /customers
- GET  /customers
- GET  /customers/{id}
- GET  /customers/{id}/history
- POST /customers/{id}/points

Eventos a publicar (cuando el broker esté listo):
- CustomerCreated
- CustomerUpdated
- PointsAssigned
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/customers", tags=["customers"])


# TODO(owner-customer): implementar.


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_cliente(payload: dict, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("")
async def listar_clientes(db: AsyncSession = Depends(get_db)) -> list[dict]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{customer_id}")
async def obtener_cliente(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{customer_id}/history")
async def historial_cliente(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[dict]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/{customer_id}/points")
async def asignar_puntos(
    customer_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")
