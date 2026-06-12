import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class FacturaItemIn(BaseModel):
    producto_id: uuid.UUID
    producto_nombre: str
    cantidad: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., ge=0)
    subtotal: Decimal = Field(..., ge=0)


class FacturaCreate(BaseModel):
    venta_id: uuid.UUID
    agencia_id: uuid.UUID
    cliente_nombre: str | None = None
    cliente_documento: str | None = None
    items: list[FacturaItemIn] = Field(..., min_length=1)
    subtotal: Decimal = Field(..., ge=0)
    total: Decimal = Field(..., ge=0)


class FacturaOut(BaseModel):
    id: uuid.UUID
    numero: str
    agencia_id: uuid.UUID
    venta_id: uuid.UUID
    cliente_nombre: str | None
    cliente_documento: str | None
    subtotal: Decimal
    iva: Decimal
    total: Decimal
    fecha_emision: datetime
    items_json: list

    model_config = ConfigDict(from_attributes=True)
