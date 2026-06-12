import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import FacturaCreate, FacturaOut

router = APIRouter(prefix="/facturas", tags=["facturacion"])


# TODO(owner-facturacion):
# - POST /facturas: generar `numero` correlativo por agencia leyendo Agencia.codigo
#   y avanzando ContadorFactura.ultimo (con SELECT FOR UPDATE para atomicidad).
#   Formato: f"{codigo_agencia}-{ultimo:08d}"  → ej. "A001-00000001".
# - El IVA se calcula como subtotal * settings.iva_rate (13%).


@router.post("", response_model=FacturaOut, status_code=status.HTTP_201_CREATED)
async def emitir_factura(payload: FacturaCreate, db: AsyncSession = Depends(get_db)) -> FacturaOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{factura_id}", response_model=FacturaOut)
async def obtener_factura(factura_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> FacturaOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("", response_model=list[FacturaOut])
async def listar_facturas(
    agencia_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[FacturaOut]:
    raise HTTPException(status_code=501, detail="No implementado")
