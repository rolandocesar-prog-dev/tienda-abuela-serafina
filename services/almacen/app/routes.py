import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Agencia, Movimiento, Stock, TipoMovimiento
from app.schemas import MovimientoCreate, MovimientoOut, StockOut

router = APIRouter(tags=["almacen"])


# ---------- Stock ----------
@router.get("/stock", response_model=list[StockOut])
async def consultar_stock(
    agencia_id: uuid.UUID | None = None,
    producto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Stock]:
    stmt = select(Stock)
    if agencia_id is not None:
        stmt = stmt.where(Stock.agencia_id == agencia_id)
    if producto_id is not None:
        stmt = stmt.where(Stock.producto_id == producto_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------- Movimientos ----------
@router.post("/movimientos", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(
    payload: MovimientoCreate,
    db: AsyncSession = Depends(get_db),
) -> Movimiento:
    # Validar que la agencia exista (los UUIDs vienen del seed compartido)
    agencia = await db.get(Agencia, payload.agencia_id)
    if agencia is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia {payload.agencia_id} no existe",
        )

    # Lock pesimista sobre la fila de stock (si existe) para evitar carreras
    # entre dos movimientos concurrentes sobre la misma (agencia, producto).
    stmt = (
        select(Stock)
        .where(Stock.agencia_id == payload.agencia_id)
        .where(Stock.producto_id == payload.producto_id)
        .with_for_update()
    )
    stock = (await db.execute(stmt)).scalar_one_or_none()

    if payload.tipo == TipoMovimiento.entrada:
        nueva_cantidad = (stock.cantidad if stock else 0) + payload.cantidad
    elif payload.tipo == TipoMovimiento.salida:
        actual = stock.cantidad if stock else 0
        if actual < payload.cantidad:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Stock insuficiente: producto {payload.producto_id} en agencia "
                    f"{payload.agencia_id} tiene {actual}, se intentó sacar {payload.cantidad}"
                ),
            )
        nueva_cantidad = actual - payload.cantidad
    else:  # ajuste
        nueva_cantidad = payload.cantidad

    if stock is None:
        stock = Stock(
            agencia_id=payload.agencia_id,
            producto_id=payload.producto_id,
            cantidad=nueva_cantidad,
        )
        db.add(stock)
    else:
        stock.cantidad = nueva_cantidad

    movimiento = Movimiento(
        tipo=payload.tipo,
        agencia_id=payload.agencia_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=payload.referencia,
    )
    db.add(movimiento)

    await db.commit()
    await db.refresh(movimiento)
    return movimiento


@router.get("/movimientos", response_model=list[MovimientoOut])
async def listar_movimientos(
    agencia_id: uuid.UUID | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Movimiento]:
    stmt = select(Movimiento).order_by(Movimiento.fecha.desc())
    if agencia_id is not None:
        stmt = stmt.where(Movimiento.agencia_id == agencia_id)
    if desde is not None:
        stmt = stmt.where(Movimiento.fecha >= desde)
    if hasta is not None:
        stmt = stmt.where(Movimiento.fecha <= hasta)
    result = await db.execute(stmt)
    return list(result.scalars().all())
