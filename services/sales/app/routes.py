"""
Sales Service — Equipo 3 del PDF.

Endpoints exigidos por el PDF:
- POST /sales
- GET  /sales
- GET  /sales/{id}

Eventos a publicar (cuando el broker esté listo):
- SaleCreated, SaleCancelled, SaleCompleted

NOTA: la orquestación previa (que llamaba a Pagos y Facturacion) fue archivada
con el pivote total. El owner de Sales reconstruye el POST /sales para:
  1. Validar producto (REST → Product Service)
  2. Validar y descontar stock (REST → Inventory Service)
  3. Crear la venta local
  4. Publicar evento SaleCompleted al broker (lo consume Notification + Customer
     para asignar puntos)

Para destrabar al equipo, GET /sales y GET /sales/{id} ya devuelven datos.
POST /sales devuelve 501 hasta que el owner lo implemente.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Venta
from app.schemas import VentaCreate, VentaOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(payload: VentaCreate, db: AsyncSession = Depends(get_db)) -> Venta:
    # TODO(owner-sales): implementar orquestación según el comentario del módulo.
    raise HTTPException(status_code=501, detail="No implementado")


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
