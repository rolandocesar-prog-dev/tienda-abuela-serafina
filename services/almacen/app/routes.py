import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Stock, Movimiento, TipoMovimiento
from app.schemas import MovimientoCreate, MovimientoOut, StockOut

# Prefijo vacío para que coincida perfectamente con el Gateway
router = APIRouter(prefix="", tags=["almacen"])

@router.get("/stock", response_model=list[StockOut])
async def consultar_stock(
    agencia_id: uuid.UUID | None = None,
    producto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[StockOut]:
    query = select(Stock)
    if agencia_id: query = query.where(Stock.agencia_id == agencia_id)
    if producto_id: query = query.where(Stock.producto_id == producto_id)
    
    result = await db.execute(query)
    return list(result.scalars().all())

@router.post("/movimientos", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(payload: MovimientoCreate, db: AsyncSession = Depends(get_db)) -> MovimientoOut:
    # 1. Obtener stock existente para el producto/agencia
    query = select(Stock).where(
        Stock.agencia_id == payload.agencia_id,
        Stock.producto_id == payload.producto_id
    )
    result = await db.execute(query)
    stock = result.scalar_one_or_none()
    
    cantidad_actual = stock.cantidad if stock else 0
    
    # 2. Validar stock en caso de salida
    if payload.tipo == TipoMovimiento.salida and cantidad_actual < payload.cantidad:
        raise HTTPException(status_code=409, detail="Stock insuficiente para esta salida.")

    # 3. Calcular nueva cantidad
    if payload.tipo == TipoMovimiento.entrada:
        nueva_cantidad = cantidad_actual + payload.cantidad
    elif payload.tipo == TipoMovimiento.salida:
        nueva_cantidad = cantidad_actual - payload.cantidad
    else: # ajuste (reemplaza el stock actual)
        nueva_cantidad = payload.cantidad

    # 4. Actualizar o crear stock
    if stock:
        stock.cantidad = nueva_cantidad
    else:
        nuevo_stock = Stock(agencia_id=payload.agencia_id, producto_id=payload.producto_id, cantidad=nueva_cantidad)
        db.add(nuevo_stock)

    # 5. Guardar el registro del movimiento
    movimiento = Movimiento(**payload.model_dump())
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
) -> list[MovimientoOut]:
    query = select(Movimiento)
    if agencia_id: query = query.where(Movimiento.agencia_id == agencia_id)
    if desde: query = query.where(Movimiento.fecha >= desde)
    if hasta: query = query.where(Movimiento.fecha <= hasta)
    
    result = await db.execute(query.order_by(Movimiento.fecha.desc()))
    return list(result.scalars().all())