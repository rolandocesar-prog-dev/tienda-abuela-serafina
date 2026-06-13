import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Factura, Agencia, ContadorFactura
from app.schemas import FacturaCreate, FacturaOut

# Prefijo vacío para compatibilidad con Gateway (Nginx)
router = APIRouter(prefix="", tags=["facturacion"])

IVA_RATE = Decimal("0.13")


@router.post("/", response_model=FacturaOut, status_code=status.HTTP_201_CREATED)
async def emitir_factura(payload: FacturaCreate, db: AsyncSession = Depends(get_db)) -> FacturaOut:
    # 1. Obtener la agencia o crear una por defecto si no existe localmente
    agencia = await db.get(Agencia, payload.agencia_id)
    if not agencia:
        agencia = Agencia(
            id=payload.agencia_id,
            sucursal_id=uuid.uuid4(),  # ID genérico por seguridad
            nombre="Agencia Auto-generada",
            codigo="A999"
        )
        db.add(agencia)
        await db.flush()

    # 2. Bloquear y actualizar el contador (Select FOR UPDATE atómico)
    stmt = select(ContadorFactura).where(ContadorFactura.agencia_id == payload.agencia_id).with_for_update()
    result = await db.execute(stmt)
    contador = result.scalars().first()

    if not contador:
        contador = ContadorFactura(agencia_id=payload.agencia_id, ultimo=0)
        db.add(contador)
        await db.flush()

    contador.ultimo += 1
    nuevo_numero = f"{agencia.codigo}-{contador.ultimo:08d}"

    # 3. Calcular IVA y validar
    subtotal = payload.subtotal
    iva = subtotal * IVA_RATE
    total = subtotal + iva

    # Serializar items a JSON
    items_json = [item.model_dump(mode="json") for item in payload.items]

    # 4. Crear factura
    nueva_factura = Factura(
        numero=nuevo_numero,
        agencia_id=payload.agencia_id,
        venta_id=payload.venta_id,
        cliente_nombre=payload.cliente_nombre,
        cliente_documento=payload.cliente_documento,
        subtotal=subtotal,
        iva=iva,
        total=total,
        items_json=items_json
    )
    
    db.add(nueva_factura)
    try:
        await db.commit()
        await db.refresh(nueva_factura)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Error de integridad: Ya existe una factura para esta venta. {str(e)}")

    return nueva_factura


@router.get("/{factura_id}", response_model=FacturaOut)
async def obtener_factura(factura_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> FacturaOut:
    factura = await db.get(Factura, factura_id)
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return factura


@router.get("/", response_model=list[FacturaOut])
async def listar_facturas(
    agencia_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[FacturaOut]:
    stmt = select(Factura)
    if agencia_id:
        stmt = stmt.where(Factura.agencia_id == agencia_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())