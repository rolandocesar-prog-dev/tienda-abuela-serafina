import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import EstadoOrden


# ---------- Proveedor ----------
class ProveedorBase(BaseModel):
    nombre: str
    nit: str
    telefono: str | None = None
    email: str | None = None


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorOut(ProveedorBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


# ---------- Orden de compra ----------
class OrdenItemIn(BaseModel):
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., ge=0)


class OrdenCompraCreate(BaseModel):
    proveedor_id: uuid.UUID
    agencia_destino_id: uuid.UUID
    items: list[OrdenItemIn] = Field(..., min_length=1)


class OrdenItemOut(BaseModel):
    id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    model_config = ConfigDict(from_attributes=True)


class OrdenCompraOut(BaseModel):
    id: uuid.UUID
    proveedor_id: uuid.UUID
    agencia_destino_id: uuid.UUID
    fecha: datetime
    estado: EstadoOrden
    total: Decimal
    cuenta_por_pagar_id: uuid.UUID | None
    items: list[OrdenItemOut] = []
    model_config = ConfigDict(from_attributes=True)
