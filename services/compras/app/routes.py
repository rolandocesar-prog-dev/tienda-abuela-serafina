import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    OrdenCompraCreate,
    OrdenCompraOut,
    ProveedorCreate,
    ProveedorOut,
)
from app.models import EstadoOrden

router = APIRouter(tags=["compras"])


# TODO(owner-compras): el endpoint /ordenes-compra/{id}/recepcion orquesta:
#   1. Por cada item: POST /movimientos (tipo="entrada", agencia_destino_id) en Almacen.
#   2. POST /cuentas-por-pagar en Pagos con proveedor_id, orden_compra_id, monto_total.
#   3. Actualizar OrdenCompra a estado=recibida con cuenta_por_pagar_id.


# ---------- Proveedores ----------
@router.post("/proveedores", response_model=ProveedorOut, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(payload: ProveedorCreate, db: AsyncSession = Depends(get_db)) -> ProveedorOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/proveedores", response_model=list[ProveedorOut])
async def listar_proveedores(db: AsyncSession = Depends(get_db)) -> list[ProveedorOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def obtener_proveedor(proveedor_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProveedorOut:
    raise HTTPException(status_code=501, detail="No implementado")


# ---------- Órdenes de compra ----------
@router.post("/ordenes-compra", response_model=OrdenCompraOut, status_code=status.HTTP_201_CREATED)
async def crear_orden(payload: OrdenCompraCreate, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/ordenes-compra/{orden_id}", response_model=OrdenCompraOut)
async def obtener_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/ordenes-compra", response_model=list[OrdenCompraOut])
async def listar_ordenes(
    estado: EstadoOrden | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[OrdenCompraOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/ordenes-compra/{orden_id}/recepcion", response_model=OrdenCompraOut)
async def recepcionar_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    raise HTTPException(status_code=501, detail="No implementado")
