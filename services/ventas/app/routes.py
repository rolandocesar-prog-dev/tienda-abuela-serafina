import uuid
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import AlmacenClient, CatalogClient, FacturacionClient, PagosClient
from app.config import settings
from app.database import get_db
from app.models import Agencia, EstadoVenta, Venta, VentaItem
from app.schemas import VentaCreate, VentaOut

router = APIRouter(prefix="/ventas", tags=["ventas"])


def _redondear(monto: Decimal) -> Decimal:
    return monto.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(payload: VentaCreate, db: AsyncSession = Depends(get_db)) -> Venta:
    """
    Orquesta el flujo end-to-end de una venta:
      1. Valida agencia.
      2. Lee precios + nombres de Catalog.
      3. Descuenta stock en Almacen (compensa con entradas si algo falla).
      4. Crea la Venta local en estado pendiente.
      5. Registra el pago en Pagos.
      6. Emite la factura en Facturación.
      7. Marca la venta como pagada con pago_id y factura_id.
    Si Pagos o Facturación fallan, compensa stock y marca la venta cancelada.
    """
    if await db.get(Agencia, payload.agencia_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia {payload.agencia_id} no existe",
        )

    # 1. Catalog: traer info de cada producto.
    items_resueltos: list[dict] = []
    subtotal_total = Decimal("0")
    for it in payload.items:
        producto = await CatalogClient.get_product(it.producto_id)
        precio = Decimal(str(producto["precio_base"]))
        subtotal_item = precio * it.cantidad
        items_resueltos.append({
            "producto_id": it.producto_id,
            "producto_nombre": producto["nombre"],
            "cantidad": it.cantidad,
            "precio_unitario": precio,
            "subtotal": subtotal_item,
        })
        subtotal_total += subtotal_item

    # 2. Almacen: salidas con compensación si alguna falla.
    salidas_aplicadas: list[dict] = []
    try:
        for item in items_resueltos:
            mov = {
                "tipo": "salida",
                "agencia_id": str(payload.agencia_id),
                "producto_id": str(item["producto_id"]),
                "cantidad": item["cantidad"],
                "referencia": "venta:pendiente",  # se actualiza con id real luego
            }
            await AlmacenClient.crear_movimiento(mov)
            salidas_aplicadas.append(mov)
    except HTTPException:
        await _compensar_salidas(salidas_aplicadas)
        raise

    # IVA y total finales. Debe coincidir con lo que facturacion calcula
    # internamente, porque vamos a cobrar este total via Pagos.
    subtotal_redondeado = _redondear(subtotal_total)
    iva = _redondear(subtotal_redondeado * Decimal(str(settings.iva_rate)))
    total_con_iva = subtotal_redondeado + iva

    # 3. Crear la Venta localmente (estado pendiente).
    venta = Venta(
        agencia_id=payload.agencia_id,
        cliente_nombre=payload.cliente_nombre,
        cliente_documento=payload.cliente_documento,
        subtotal=subtotal_redondeado,
        total=total_con_iva,
        estado=EstadoVenta.pendiente,
        items=[
            VentaItem(
                producto_id=i["producto_id"],
                producto_nombre=i["producto_nombre"],
                cantidad=i["cantidad"],
                precio_unitario=i["precio_unitario"],
                subtotal=i["subtotal"],
            )
            for i in items_resueltos
        ],
    )
    db.add(venta)
    await db.commit()
    await db.refresh(venta)

    # 4. Pagos — cobramos el total con IVA.
    try:
        pago = await PagosClient.crear_pago({
            "tipo": "venta",
            "referencia_id": str(venta.id),
            "monto": str(total_con_iva),
            "metodo": payload.metodo_pago,
        })
    except HTTPException:
        await _compensar_salidas(salidas_aplicadas)
        venta.estado = EstadoVenta.cancelada
        await db.commit()
        raise

    # 5. Facturación.
    try:
        factura = await FacturacionClient.emitir_factura({
            "venta_id": str(venta.id),
            "agencia_id": str(payload.agencia_id),
            "cliente_nombre": payload.cliente_nombre,
            "cliente_documento": payload.cliente_documento,
            "items": [
                {
                    "producto_id": str(i["producto_id"]),
                    "producto_nombre": i["producto_nombre"],
                    "cantidad": i["cantidad"],
                    "precio_unitario": str(i["precio_unitario"]),
                    "subtotal": str(i["subtotal"]),
                }
                for i in items_resueltos
            ],
            "subtotal": str(subtotal_redondeado),
            "total": str(total_con_iva),
        })
    except HTTPException:
        await _compensar_salidas(salidas_aplicadas)
        venta.estado = EstadoVenta.cancelada
        await db.commit()
        raise

    # 6. Cerrar venta.
    venta.pago_id = uuid.UUID(pago["id"])
    venta.factura_id = uuid.UUID(factura["id"])
    venta.estado = EstadoVenta.pagada
    await db.commit()
    await db.refresh(venta)
    return venta


@router.get("/{venta_id}", response_model=VentaOut)
async def obtener_venta(venta_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Venta:
    venta = await db.get(Venta, venta_id)
    if venta is None:
        raise HTTPException(status_code=404, detail=f"Venta {venta_id} no encontrada")
    return venta


@router.get("", response_model=list[VentaOut])
async def listar_ventas(
    agencia_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Venta]:
    stmt = select(Venta).order_by(Venta.fecha.desc())
    if agencia_id is not None:
        stmt = stmt.where(Venta.agencia_id == agencia_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _compensar_salidas(salidas: list[dict]) -> None:
    """Revierte cada salida con una entrada del mismo tamaño."""
    for s in salidas:
        try:
            await AlmacenClient.crear_movimiento({
                **s,
                "tipo": "entrada",
                "referencia": s["referencia"] + ":compensacion",
            })
        except HTTPException:
            # Best-effort: si la compensación falla queda inconsistencia operativa.
            pass
