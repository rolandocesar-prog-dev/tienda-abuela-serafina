import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import AlmacenClient, PagosClient
from app.database import get_db
from app.models import (
    Agencia,
    EstadoOrden,
    OrdenCompra,
    OrdenCompraItem,
    Proveedor,
)
from app.schemas import (
    OrdenCompraCreate,
    OrdenCompraOut,
    ProveedorCreate,
    ProveedorOut,
)

router = APIRouter(tags=["compras"])


# ---------- Proveedores ----------
@router.post("/proveedores", response_model=ProveedorOut, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(payload: ProveedorCreate, db: AsyncSession = Depends(get_db)) -> Proveedor:
    proveedor = Proveedor(**payload.model_dump())
    db.add(proveedor)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un proveedor con NIT '{payload.nit}'",
        )
    await db.refresh(proveedor)
    return proveedor


@router.get("/proveedores", response_model=list[ProveedorOut])
async def listar_proveedores(db: AsyncSession = Depends(get_db)) -> list[Proveedor]:
    result = await db.execute(select(Proveedor).order_by(Proveedor.nombre))
    return list(result.scalars().all())


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def obtener_proveedor(proveedor_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Proveedor:
    proveedor = await db.get(Proveedor, proveedor_id)
    if proveedor is None:
        raise HTTPException(status_code=404, detail=f"Proveedor {proveedor_id} no encontrado")
    return proveedor


# ---------- Órdenes de compra ----------
@router.post("/ordenes-compra", response_model=OrdenCompraOut, status_code=status.HTTP_201_CREATED)
async def crear_orden(payload: OrdenCompraCreate, db: AsyncSession = Depends(get_db)) -> OrdenCompra:
    # Validar proveedor y agencia destino existen.
    if await db.get(Proveedor, payload.proveedor_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Proveedor {payload.proveedor_id} no existe",
        )
    if await db.get(Agencia, payload.agencia_destino_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia {payload.agencia_destino_id} no existe",
        )

    total = Decimal("0")
    items_db: list[OrdenCompraItem] = []
    for item in payload.items:
        subtotal = item.precio_unitario * item.cantidad
        items_db.append(
            OrdenCompraItem(
                producto_id=item.producto_id,
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                subtotal=subtotal,
            )
        )
        total += subtotal

    orden = OrdenCompra(
        proveedor_id=payload.proveedor_id,
        agencia_destino_id=payload.agencia_destino_id,
        total=total,
        items=items_db,
    )
    db.add(orden)
    await db.commit()
    await db.refresh(orden)
    return orden


@router.get("/ordenes-compra/{orden_id}", response_model=OrdenCompraOut)
async def obtener_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompra:
    orden = await db.get(OrdenCompra, orden_id)
    if orden is None:
        raise HTTPException(status_code=404, detail=f"Orden {orden_id} no encontrada")
    return orden


@router.get("/ordenes-compra", response_model=list[OrdenCompraOut])
async def listar_ordenes(
    estado: EstadoOrden | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[OrdenCompra]:
    stmt = select(OrdenCompra).order_by(OrdenCompra.fecha.desc())
    if estado is not None:
        stmt = stmt.where(OrdenCompra.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/ordenes-compra/{orden_id}/recepcion", response_model=OrdenCompraOut)
async def recepcionar_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompra:
    """
    Orquesta la recepción de mercadería:
      1. Por cada item → Almacen POST /movimientos (entrada).
      2. Pagos POST /cuentas-por-pagar.
      3. Marca la orden recibida con cuenta_por_pagar_id.
    Si Pagos falla, compensa todas las entradas con salidas.
    """
    orden = await db.get(OrdenCompra, orden_id)
    if orden is None:
        raise HTTPException(status_code=404, detail=f"Orden {orden_id} no encontrada")
    if orden.estado != EstadoOrden.pendiente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Orden ya está en estado '{orden.estado.value}', no se puede recepcionar",
        )

    # 1. Registrar entradas en Almacen. Guardamos lo que se aplicó para poder revertir.
    entradas_aplicadas: list[dict] = []
    try:
        for item in orden.items:
            payload = {
                "tipo": "entrada",
                "agencia_id": str(orden.agencia_destino_id),
                "producto_id": str(item.producto_id),
                "cantidad": item.cantidad,
                "referencia": f"orden-compra:{orden.id}",
            }
            await AlmacenClient.crear_movimiento(payload)
            entradas_aplicadas.append(payload)
    except HTTPException:
        # Si una entrada falla, compensamos las anteriores con salidas.
        await _compensar_entradas(entradas_aplicadas)
        raise

    # 2. Crear cuenta por pagar en Pagos.
    try:
        cxp = await PagosClient.crear_cuenta_por_pagar({
            "proveedor_id": str(orden.proveedor_id),
            "orden_compra_id": str(orden.id),
            "monto_total": str(orden.total),
        })
    except HTTPException:
        await _compensar_entradas(entradas_aplicadas)
        raise

    # 3. Persistir cambios.
    orden.estado = EstadoOrden.recibida
    orden.cuenta_por_pagar_id = uuid.UUID(cxp["id"])
    await db.commit()
    await db.refresh(orden)
    return orden


async def _compensar_entradas(entradas: list[dict]) -> None:
    """Revierte cada entrada con un movimiento de salida del mismo tamaño."""
    for entrada in entradas:
        try:
            await AlmacenClient.crear_movimiento({
                **entrada,
                "tipo": "salida",
                "referencia": entrada["referencia"] + ":compensacion",
            })
        except HTTPException:
            # Best-effort: si falla la compensación queda como inconsistencia operativa.
            # En un sistema real esto iría a una cola de retry.
            pass
