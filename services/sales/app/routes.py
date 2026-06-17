"""
Sales Service — Equipo 3 del PDF.

Endpoints:
- POST /sales   → orquesta product + inventory, registra venta, publica SaleCompleted
- GET  /sales
- GET  /sales/{id}
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import InventoryClient, ProductClient
from app.config import settings
from app.database import get_db
from app.events import emit_sale_completed
from app.models import Venta, VentaItem
from app.schemas import VentaCreate, VentaOut
from app.security import verify_jwt

router = APIRouter(prefix="/sales", tags=["sales"], dependencies=[Depends(verify_jwt)])


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    return auth.removeprefix("Bearer ").strip()


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(
    request: Request,
    payload: VentaCreate,
    db: AsyncSession = Depends(get_db),
) -> Venta:
    """
    Orquestación de venta:
    1. Valida cada producto en Product Service y obtiene precio.
    2. Descuenta stock en Inventory Service.
    3. Persiste la Venta y sus items localmente.
    4. Publica SaleCompleted al broker (Notification lo consume; Customer
       asignará puntos cuando su servicio esté implementado).
    """
    token = _extract_token(request)

    # --- 1. Validar productos y obtener precios ---
    items_enriquecidos: list[dict] = []
    for item in payload.items:
        producto = await ProductClient.get_product(item.producto_id, token)
        precio = Decimal(str(producto.get("precio_base", 0)))
        if precio <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Producto {item.producto_id} no tiene precio válido",
            )
        items_enriquecidos.append({
            "producto_id": item.producto_id,
            "producto_nombre": producto.get("nombre", ""),
            "cantidad": item.cantidad,
            "precio_unitario": precio,
            "subtotal": precio * item.cantidad,
        })

    # --- 2. Descontar stock (una llamada por item) ---
    for item_data in items_enriquecidos:
        await InventoryClient.descontar_stock(
            {
                "agencia_id": str(payload.agencia_id),
                "producto_id": str(item_data["producto_id"]),
                "cantidad": item_data["cantidad"],
                "motivo": "venta",
            },
            token,
        )

    # --- 3. Calcular totales y persistir ---
    subtotal = sum(i["subtotal"] for i in items_enriquecidos)
    total = (subtotal * (1 + Decimal(str(settings.iva_rate)))).quantize(Decimal("0.01"))

    venta = Venta(
        agencia_id=payload.agencia_id,
        cliente_nombre=payload.cliente_nombre,
        cliente_documento=payload.cliente_documento,
        metodo_pago=payload.metodo_pago,
        subtotal=subtotal,
        total=total,
    )
    db.add(venta)
    await db.flush()  # obtener venta.id antes de los items

    for item_data in items_enriquecidos:
        db.add(VentaItem(
            venta_id=venta.id,
            producto_id=item_data["producto_id"],
            producto_nombre=item_data["producto_nombre"],
            cantidad=item_data["cantidad"],
            precio_unitario=item_data["precio_unitario"],
            subtotal=item_data["subtotal"],
        ))

    await db.commit()
    await db.refresh(venta)

    # --- 4. Publicar evento ---
    await emit_sale_completed(
        venta_id=str(venta.id),
        agencia_id=str(venta.agencia_id),
        cliente_nombre=venta.cliente_nombre,
        cliente_documento=venta.cliente_documento,
        subtotal=venta.subtotal,
        total=venta.total,
        items=[
            {
                "producto_id": str(i["producto_id"]),
                "producto_nombre": i["producto_nombre"],
                "cantidad": i["cantidad"],
                "precio_unitario": str(i["precio_unitario"]),
            }
            for i in items_enriquecidos
        ],
    )

    return venta


@router.get("/{venta_id}", response_model=VentaOut)
async def obtener_venta(venta_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Venta:
    venta = await db.get(Venta, venta_id)
    if venta is None:
        raise HTTPException(status_code=404, detail=f"Venta {venta_id} no encontrada")
    return venta


@router.get("", response_model=list[VentaOut])
async def listar_ventas(db: AsyncSession = Depends(get_db)) -> list[Venta]:
    stmt = select(Venta).order_by(Venta.fecha.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
