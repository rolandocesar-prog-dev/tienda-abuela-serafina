import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import (
    CuentaPorCobrar,
    CuentaPorPagar,
    EstadoCuenta,
    EstadoPago,
    MetodoPago,
    Pago,
)
from app.schemas import (
    AbonoCuenta,
    CuentaCobrarCreate,
    CuentaCobrarOut,
    CuentaPagarCreate,
    CuentaPagarOut,
    PagoCreate,
    PagoOut,
)

router = APIRouter(tags=["pagos"])


# ---------- Pagos ----------
@router.post("/pagos", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def crear_pago(payload: PagoCreate, db: AsyncSession = Depends(get_db)) -> PagoOut:
    if payload.metodo == MetodoPago.tarjeta:
        # Stripe se implementará en un commit separado. Hasta entonces, si alguien
        # intenta pagar con tarjeta y no hay llave de Stripe configurada → 503.
        if not settings.stripe_secret_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Pagos con tarjeta no disponibles: Stripe no configurado",
            )
        # TODO(stripe): crear PaymentIntent y devolver client_secret.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Pagos con tarjeta aún no implementados",
        )

    # Efectivo / transferencia: marcamos completado directamente.
    pago = Pago(
        tipo=payload.tipo,
        referencia_id=payload.referencia_id,
        monto=payload.monto,
        metodo=payload.metodo,
        estado=EstadoPago.completado,
    )
    db.add(pago)
    await db.commit()
    await db.refresh(pago)
    return PagoOut.model_validate(pago)


@router.get("/pagos/{pago_id}", response_model=PagoOut)
async def obtener_pago(pago_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Pago:
    pago = await db.get(Pago, pago_id)
    if pago is None:
        raise HTTPException(status_code=404, detail=f"Pago {pago_id} no encontrado")
    return pago


@router.post("/pagos/stripe/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    # TODO(stripe): validar firma con STRIPE_WEBHOOK_SECRET y actualizar estado.
    raise HTTPException(status_code=501, detail="Webhook de Stripe aún no implementado")


# ---------- Cuentas por pagar ----------
@router.post("/cuentas-por-pagar", response_model=CuentaPagarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_pagar(payload: CuentaPagarCreate, db: AsyncSession = Depends(get_db)) -> CuentaPorPagar:
    cuenta = CuentaPorPagar(
        proveedor_id=payload.proveedor_id,
        orden_compra_id=payload.orden_compra_id,
        monto_total=payload.monto_total,
    )
    db.add(cuenta)
    await db.commit()
    await db.refresh(cuenta)
    return cuenta


@router.get("/cuentas-por-pagar", response_model=list[CuentaPagarOut])
async def listar_cuentas_pagar(
    estado: EstadoCuenta | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CuentaPorPagar]:
    stmt = select(CuentaPorPagar).order_by(CuentaPorPagar.fecha_creacion.desc())
    if estado is not None:
        stmt = stmt.where(CuentaPorPagar.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/cuentas-por-pagar/{cuenta_id}/pago", response_model=CuentaPagarOut)
async def abonar_cuenta_pagar(
    cuenta_id: uuid.UUID,
    payload: AbonoCuenta,
    db: AsyncSession = Depends(get_db),
) -> CuentaPorPagar:
    cuenta = await db.get(CuentaPorPagar, cuenta_id)
    if cuenta is None:
        raise HTTPException(status_code=404, detail=f"Cuenta por pagar {cuenta_id} no encontrada")

    pendiente = cuenta.monto_total - cuenta.monto_pagado
    if payload.monto > pendiente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Abono {payload.monto} excede el saldo pendiente {pendiente}",
        )

    cuenta.monto_pagado = cuenta.monto_pagado + payload.monto
    if cuenta.monto_pagado >= cuenta.monto_total:
        cuenta.estado = EstadoCuenta.pagada
    await db.commit()
    await db.refresh(cuenta)
    return cuenta


# ---------- Cuentas por cobrar ----------
@router.post("/cuentas-por-cobrar", response_model=CuentaCobrarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_cobrar(payload: CuentaCobrarCreate, db: AsyncSession = Depends(get_db)) -> CuentaPorCobrar:
    cuenta = CuentaPorCobrar(
        cliente_nombre=payload.cliente_nombre,
        venta_id=payload.venta_id,
        monto_total=payload.monto_total,
    )
    db.add(cuenta)
    await db.commit()
    await db.refresh(cuenta)
    return cuenta


@router.get("/cuentas-por-cobrar", response_model=list[CuentaCobrarOut])
async def listar_cuentas_cobrar(
    estado: EstadoCuenta | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CuentaPorCobrar]:
    stmt = select(CuentaPorCobrar).order_by(CuentaPorCobrar.fecha_creacion.desc())
    if estado is not None:
        stmt = stmt.where(CuentaPorCobrar.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().all())
