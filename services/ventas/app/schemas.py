import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import EstadoVenta


class VentaItemIn(BaseModel):
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)


class VentaCreate(BaseModel):
    agencia_id: uuid.UUID
    cliente_nombre: str | None = None
    cliente_documento: str | None = None
    metodo_pago: str = Field("efectivo", description="efectivo | tarjeta | transferencia")
    items: list[VentaItemIn] = Field(..., min_length=1)


class VentaItemOut(BaseModel):
    id: uuid.UUID
    producto_id: uuid.UUID
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class VentaOut(BaseModel):
    id: uuid.UUID
    agencia_id: uuid.UUID
    cliente_nombre: str | None
    cliente_documento: str | None
    fecha: datetime
    subtotal: Decimal
    total: Decimal
    estado: EstadoVenta
    factura_id: uuid.UUID | None
    pago_id: uuid.UUID | None
    items: list[VentaItemOut] = []

    model_config = ConfigDict(from_attributes=True)
