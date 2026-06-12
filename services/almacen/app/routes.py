import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import MovimientoCreate, MovimientoOut, StockOut

router = APIRouter(tags=["almacen"])


# TODO(owner-almacen): implementar la lógica de cada endpoint.
# Importante: el POST /movimientos debe actualizar stocks atómicamente
# y rechazar con 409 si una "salida" dejaría el stock negativo.


@router.get("/stock", response_model=list[StockOut])
async def consultar_stock(
    agencia_id: uuid.UUID | None = None,
    producto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[StockOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/movimientos", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(payload: MovimientoCreate, db: AsyncSession = Depends(get_db)) -> MovimientoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/movimientos", response_model=list[MovimientoOut])
async def listar_movimientos(
    agencia_id: uuid.UUID | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[MovimientoOut]:
    raise HTTPException(status_code=501, detail="No implementado")
