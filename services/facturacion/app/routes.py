import uuid
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Agencia, ContadorFactura, Factura
from app.schemas import FacturaCreate, FacturaOut

router = APIRouter(prefix="/facturas", tags=["facturacion"])


def _redondear(monto: Decimal) -> Decimal:
    """Redondea a 2 decimales con HALF_UP (forma estándar para moneda)."""
    return monto.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.post("", response_model=FacturaOut, status_code=status.HTTP_201_CREATED)
async def emitir_factura(payload: FacturaCreate, db: AsyncSession = Depends(get_db)) -> Factura:
    # 1. La agencia debe existir y dar su prefijo (A001, A002, ...).
    agencia = await db.get(Agencia, payload.agencia_id)
    if agencia is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia {payload.agencia_id} no existe",
        )

    # 2. Bloqueo pesimista del contador de esta agencia para serializar
    #    la asignación del correlativo. El seed garantiza que la fila exista.
    contador = (
        await db.execute(
            select(ContadorFactura)
            .where(ContadorFactura.agencia_id == payload.agencia_id)
            .with_for_update()
        )
    ).scalar_one()

    contador.ultimo += 1
    numero = f"{agencia.codigo}-{contador.ultimo:08d}"

    # 3. Calcular IVA y total desde el subtotal (servidor es la fuente de verdad).
    subtotal = _redondear(payload.subtotal)
    iva = _redondear(subtotal * Decimal(str(settings.iva_rate)))
    total = subtotal + iva

    factura = Factura(
        numero=numero,
        agencia_id=payload.agencia_id,
        venta_id=payload.venta_id,
        cliente_nombre=payload.cliente_nombre,
        cliente_documento=payload.cliente_documento,
        subtotal=subtotal,
        iva=iva,
        total=total,
        items_json=[item.model_dump(mode="json") for item in payload.items],
    )
    db.add(factura)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Únicas violaciones esperadas: factura duplicada para la misma venta_id.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una factura para la venta {payload.venta_id}",
        )
    await db.refresh(factura)
    return factura


@router.get("/{factura_id}", response_model=FacturaOut)
async def obtener_factura(factura_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Factura:
    factura = await db.get(Factura, factura_id)
    if factura is None:
        raise HTTPException(status_code=404, detail=f"Factura {factura_id} no encontrada")
    return factura


@router.get("", response_model=list[FacturaOut])
async def listar_facturas(
    agencia_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Factura]:
    stmt = select(Factura).order_by(Factura.fecha_emision.desc())
    if agencia_id is not None:
        stmt = stmt.where(Factura.agencia_id == agencia_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
