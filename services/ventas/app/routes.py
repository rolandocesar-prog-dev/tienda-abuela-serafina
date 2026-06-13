import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Venta, VentaItem
from app.schemas import VentaCreate, VentaOut

# Prefijo establecido en /ventas
router = APIRouter(prefix="", tags=["ventas"])

CATALOG_URL = "http://catalog:8000"
ALMACEN_URL = "http://almacen:8000"

@router.post("/", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(payload: VentaCreate, db: AsyncSession = Depends(get_db)) -> VentaOut:
    async with httpx.AsyncClient() as client:
        venta_items = []
        total_venta = 0

        for item in payload.items:
            # Validar existencia
            prod_res = await client.get(f"{CATALOG_URL}/productos/{item.producto_id}")
            if prod_res.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no encontrado")
            prod = prod_res.json()

            # Registrar salida
            mov_payload = {
                "agencia_id": str(payload.agencia_id),
                "producto_id": str(item.producto_id),
                "cantidad": item.cantidad,
                "tipo": "salida"
            }
            mov_res = await client.post(f"{ALMACEN_URL}/movimientos", json=mov_payload)
            if mov_res.status_code != 201:
                raise HTTPException(status_code=409, detail="Stock insuficiente")

            subtotal = float(prod["precio_base"]) * item.cantidad
            total_venta += subtotal
            
            venta_items.append(VentaItem(
                producto_id=item.producto_id,
                producto_nombre=prod["nombre"],
                cantidad=item.cantidad,
                precio_unitario=prod["precio_base"],
                subtotal=subtotal
            ))

        nueva_venta = Venta(
            agencia_id=payload.agencia_id,
            cliente_nombre=payload.cliente_nombre,
            cliente_documento=payload.cliente_documento,
            total=total_venta,
            subtotal=total_venta,
            items=venta_items
        )
        db.add(nueva_venta)
        await db.commit()
        await db.refresh(nueva_venta)
        return nueva_venta

@router.get("/{venta_id}", response_model=VentaOut)
async def obtener_venta(venta_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> VentaOut:
    venta = await db.get(Venta, venta_id)
    if not venta: raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta

@router.get("/", response_model=list[VentaOut])
async def listar_ventas(agencia_id: uuid.UUID | None = None, db: AsyncSession = Depends(get_db)) -> list[VentaOut]:
    stmt = select(Venta)
    if agencia_id: stmt = stmt.where(Venta.agencia_id == agencia_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())