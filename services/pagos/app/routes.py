import asyncio
import logging
import uuid
from decimal import Decimal

import stripe
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
logger = logging.getLogger(settings.service_name)

# Stripe maneja montos en la unidad mínima (centavos para USD/BOB).
STRIPE_CURRENCY = "usd"
# Tratamos el placeholder del .env.example como "no configurado".
_STRIPE_PLACEHOLDERS = {"", "sk_test_REEMPLAZAR", "whsec_REEMPLAZAR"}


def _stripe_configurado() -> bool:
    return settings.stripe_secret_key not in _STRIPE_PLACEHOLDERS


# ---------- Pagos ----------
@router.post("/pagos", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def crear_pago(payload: PagoCreate, db: AsyncSession = Depends(get_db)) -> PagoOut:
    if payload.metodo == MetodoPago.tarjeta:
        if not _stripe_configurado():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Pagos con tarjeta no disponibles: STRIPE_SECRET_KEY no configurado",
            )

        stripe.api_key = settings.stripe_secret_key
        # Stripe espera el monto en la unidad mínima (centavos).
        amount_cents = int((payload.monto * 100).quantize(Decimal("1")))

        try:
            intent = await asyncio.to_thread(
                stripe.PaymentIntent.create,
                amount=amount_cents,
                currency=STRIPE_CURRENCY,
                metadata={
                    "tipo": payload.tipo.value,
                    "referencia_id": str(payload.referencia_id),
                },
                automatic_payment_methods={"enabled": True},
            )
        except stripe.StripeError as e:
            logger.warning("Stripe rechazo el PaymentIntent: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Stripe rechazó el cobro: {e.user_message or str(e)}",
            )

        pago = Pago(
            tipo=payload.tipo,
            referencia_id=payload.referencia_id,
            monto=payload.monto,
            metodo=payload.metodo,
            estado=EstadoPago.pendiente,
            stripe_payment_intent_id=intent.id,
        )
        db.add(pago)
        await db.commit()
        await db.refresh(pago)

        out = PagoOut.model_validate(pago)
        out.client_secret = intent.client_secret
        return out

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
    """
    Endpoint para que Stripe nos notifique cambios de estado.
    Valida la firma con STRIPE_WEBHOOK_SECRET y actualiza el Pago.
    """
    if settings.stripe_webhook_secret in _STRIPE_PLACEHOLDERS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook deshabilitado: STRIPE_WEBHOOK_SECRET no configurado",
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload inválido")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma de Stripe inválida")

    tipo = event["type"]
    intent = event["data"]["object"]
    intent_id = intent.get("id")

    pago = (
        await db.execute(select(Pago).where(Pago.stripe_payment_intent_id == intent_id))
    ).scalar_one_or_none()

    if pago is None:
        logger.warning("Webhook recibido para intent desconocido: %s", intent_id)
        return {"received": True, "ignored": True}

    if tipo == "payment_intent.succeeded":
        pago.estado = EstadoPago.completado
    elif tipo == "payment_intent.payment_failed":
        pago.estado = EstadoPago.fallido
    else:
        logger.info("Webhook tipo no manejado: %s", tipo)
        return {"received": True, "ignored": True}

    await db.commit()
    return {"received": True, "pago_id": str(pago.id), "estado": pago.estado.value}


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
