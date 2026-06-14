import os
import uuid
import stripe

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Pago, CuentaPorPagar, CuentaPorCobrar, EstadoCuenta, EstadoPago, MetodoPago, TipoPago
from app.schemas import (
    AbonoCuenta,
    CuentaCobrarCreate,
    CuentaCobrarOut,
    CuentaPagarCreate,
    CuentaPagarOut,
    PagoCreate,
    PagoOut,
)

# Prefijo vacío para compatibilidad con Nginx Gateway
router = APIRouter(prefix="", tags=["pagos"])

# Cargar la llave de Stripe desde el docker-compose
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


# ---------- Pagos ----------
@router.post("/pagos", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def crear_pago(payload: PagoCreate, db: AsyncSession = Depends(get_db)):
    nuevo_pago = Pago(
        tipo=payload.tipo,
        referencia_id=payload.referencia_id,
        monto=payload.monto,
        metodo=payload.metodo,
    )
    
    client_secret = None

    if payload.metodo == MetodoPago.tarjeta:
        if not stripe.api_key:
            raise HTTPException(status_code=503, detail="Pasarela de pago no configurada (Falta STRIPE_SECRET_KEY)")
        
        try:
            # Crear el PaymentIntent en Stripe (monto en centavos, asumimos moneda BOB o USD)
            intent = stripe.PaymentIntent.create(
                amount=int(payload.monto * 100),
                currency="bob",
                metadata={"referencia_id": str(payload.referencia_id)}
            )
            nuevo_pago.stripe_payment_intent_id = intent.id
            nuevo_pago.estado = EstadoPago.pendiente
            client_secret = intent.client_secret
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # Efectivo o Transferencia se marcan como completados directamente
        nuevo_pago.estado = EstadoPago.completado

    db.add(nuevo_pago)

    # ACTUALIZAR CUENTA POR PAGAR
    if payload.tipo == TipoPago.compra:

        stmt = select(CuentaPorPagar).where(
            CuentaPorPagar.orden_compra_id == payload.referencia_id
        )

        result = await db.execute(stmt)

        cuenta = result.scalars().first()

        if cuenta:

            cuenta.monto_pagado += payload.monto

            if cuenta.monto_pagado >= cuenta.monto_total:

                cuenta.monto_pagado = cuenta.monto_total
                cuenta.estado = EstadoCuenta.pagada

    await db.commit()
    await db.refresh(nuevo_pago)
    
    # Truco para que Pydantic lea el client_secret aunque no esté en la BD
    setattr(nuevo_pago, 'client_secret', client_secret)
    return nuevo_pago


@router.get("/pagos/{pago_id}", response_model=PagoOut)
async def obtener_pago(pago_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    pago = await db.get(Pago, pago_id)
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return pago


@router.post("/pagos/stripe/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET or not sig_header:
        raise HTTPException(status_code=400, detail="Faltan credenciales de webhook")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firma inválida: {str(e)}")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        stmt = select(Pago).where(Pago.stripe_payment_intent_id == intent["id"])
        result = await db.execute(stmt)
        pago = result.scalars().first()
        
        if pago:
            pago.estado = EstadoPago.completado
            await db.commit()

    return {"status": "success"}


# ---------- Cuentas por pagar ----------
@router.post("/cuentas-por-pagar", response_model=CuentaPagarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_pagar(payload: CuentaPagarCreate, db: AsyncSession = Depends(get_db)):
    nueva_cuenta = CuentaPorPagar(**payload.model_dump())
    db.add(nueva_cuenta)
    await db.commit()
    await db.refresh(nueva_cuenta)
    return nueva_cuenta


@router.get("/cuentas-por-pagar", response_model=list[CuentaPagarOut])
async def listar_cuentas_pagar(estado: EstadoCuenta | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(CuentaPorPagar)
    if estado:
        stmt = stmt.where(CuentaPorPagar.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/cuentas-por-pagar/{cuenta_id}/pago", response_model=CuentaPagarOut)
async def abonar_cuenta_pagar(cuenta_id: uuid.UUID, payload: AbonoCuenta, db: AsyncSession = Depends(get_db)):
    cuenta = await db.get(CuentaPorPagar, cuenta_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta por pagar no encontrada")
    
    cuenta.monto_pagado += payload.monto
    if cuenta.monto_pagado >= cuenta.monto_total:
        cuenta.estado = EstadoCuenta.pagada
        cuenta.monto_pagado = cuenta.monto_total  # Prevenir sobrepagos matemáticos
        
    await db.commit()
    await db.refresh(cuenta)
    return cuenta


# ---------- Cuentas por cobrar ----------
@router.post("/cuentas-por-cobrar", response_model=CuentaCobrarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_cobrar(payload: CuentaCobrarCreate, db: AsyncSession = Depends(get_db)):
    nueva_cuenta = CuentaPorCobrar(**payload.model_dump())
    db.add(nueva_cuenta)
    await db.commit()
    await db.refresh(nueva_cuenta)
    return nueva_cuenta


@router.get("/cuentas-por-cobrar", response_model=list[CuentaCobrarOut])
async def listar_cuentas_cobrar(estado: EstadoCuenta | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(CuentaPorCobrar)
    if estado:
        stmt = stmt.where(CuentaPorCobrar.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().all())