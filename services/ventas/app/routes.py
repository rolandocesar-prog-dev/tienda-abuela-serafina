import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import VentaCreate, VentaOut

router = APIRouter(prefix="/ventas", tags=["ventas"])


# TODO(owner-ventas): este servicio orquesta el flujo E2E.
# Pasos del POST /ventas:
#   1. Por cada item: GET /products/{id} en Catalog → tomar nombre y precio_base.
#   2. Por cada item: POST /movimientos (tipo="salida") en Almacen → si 409 stock,
#      revertir movimientos previos llamando POST /movimientos (tipo="entrada") y devolver 409.
#   3. Crear Venta + VentaItems localmente con estado=pendiente.
#   4. POST /pagos en Pagos (tipo="venta") → guardar pago_id.
#   5. POST /facturas en Facturacion → guardar factura_id.
#   6. Actualizar Venta a estado=pagada con pago_id y factura_id.
#   7. Devolver VentaOut completa.


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(payload: VentaCreate, db: AsyncSession = Depends(get_db)) -> VentaOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{venta_id}", response_model=VentaOut)
async def obtener_venta(venta_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> VentaOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("", response_model=list[VentaOut])
async def listar_ventas(
    agencia_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[VentaOut]:
    raise HTTPException(status_code=501, detail="No implementado")
