import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EstadoCuenta
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


# TODO(owner-pagos):
# - POST /pagos con metodo="tarjeta" → crear Stripe PaymentIntent y devolver client_secret.
#   Si STRIPE_SECRET_KEY no está configurado, devolver 503.
# - POST /pagos con efectivo|transferencia → estado="completado" directo.
# - POST /pagos/stripe/webhook → validar firma con STRIPE_WEBHOOK_SECRET, actualizar estado del Pago.


# ---------- Pagos ----------
@router.post("/pagos", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def crear_pago(payload: PagoCreate, db: AsyncSession = Depends(get_db)) -> PagoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/pagos/{pago_id}", response_model=PagoOut)
async def obtener_pago(pago_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> PagoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/pagos/stripe/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(status_code=501, detail="No implementado")


# ---------- Cuentas por pagar ----------
@router.post("/cuentas-por-pagar", response_model=CuentaPagarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_pagar(payload: CuentaPagarCreate, db: AsyncSession = Depends(get_db)) -> CuentaPagarOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/cuentas-por-pagar", response_model=list[CuentaPagarOut])
async def listar_cuentas_pagar(
    estado: EstadoCuenta | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CuentaPagarOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/cuentas-por-pagar/{cuenta_id}/pago", response_model=CuentaPagarOut)
async def abonar_cuenta_pagar(
    cuenta_id: uuid.UUID,
    payload: AbonoCuenta,
    db: AsyncSession = Depends(get_db),
) -> CuentaPagarOut:
    raise HTTPException(status_code=501, detail="No implementado")


# ---------- Cuentas por cobrar ----------
@router.post("/cuentas-por-cobrar", response_model=CuentaCobrarOut, status_code=status.HTTP_201_CREATED)
async def crear_cuenta_cobrar(payload: CuentaCobrarCreate, db: AsyncSession = Depends(get_db)) -> CuentaCobrarOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/cuentas-por-cobrar", response_model=list[CuentaCobrarOut])
async def listar_cuentas_cobrar(
    estado: EstadoCuenta | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CuentaCobrarOut]:
    raise HTTPException(status_code=501, detail="No implementado")
