import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import TipoMovimiento


class StockOut(BaseModel):
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int

    model_config = ConfigDict(from_attributes=True)


class MovimientoCreate(BaseModel):
    tipo: TipoMovimiento
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    referencia: str | None = None


class MovimientoOut(BaseModel):
    id: uuid.UUID
    tipo: TipoMovimiento
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    referencia: str | None
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)
