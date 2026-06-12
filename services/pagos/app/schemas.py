import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import EstadoCuenta, EstadoPago, MetodoPago, TipoPago


# ---------- Pago ----------
class PagoCreate(BaseModel):
    tipo: TipoPago
    referencia_id: uuid.UUID
    monto: Decimal = Field(..., gt=0)
    metodo: MetodoPago


class PagoOut(BaseModel):
    id: uuid.UUID
    tipo: TipoPago
    referencia_id: uuid.UUID
    monto: Decimal
    metodo: MetodoPago
    estado: EstadoPago
    stripe_payment_intent_id: str | None
    fecha: datetime
    client_secret: str | None = None  # devuelto solo cuando metodo=tarjeta
    model_config = ConfigDict(from_attributes=True)


# ---------- Cuenta por pagar ----------
class CuentaPagarCreate(BaseModel):
    proveedor_id: uuid.UUID
    orden_compra_id: uuid.UUID
    monto_total: Decimal = Field(..., gt=0)


class CuentaPagarOut(BaseModel):
    id: uuid.UUID
    proveedor_id: uuid.UUID
    orden_compra_id: uuid.UUID
    monto_total: Decimal
    monto_pagado: Decimal
    estado: EstadoCuenta
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)


class AbonoCuenta(BaseModel):
    monto: Decimal = Field(..., gt=0)


# ---------- Cuenta por cobrar ----------
class CuentaCobrarCreate(BaseModel):
    cliente_nombre: str
    venta_id: uuid.UUID
    monto_total: Decimal = Field(..., gt=0)


class CuentaCobrarOut(BaseModel):
    id: uuid.UUID
    cliente_nombre: str
    venta_id: uuid.UUID
    monto_total: Decimal
    monto_pagado: Decimal
    estado: EstadoCuenta
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)
