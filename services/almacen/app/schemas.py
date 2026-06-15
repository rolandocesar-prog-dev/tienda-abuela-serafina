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
    cantidad_antes: int = 0  # Campo que existe en el modelo
    cantidad_despues: int = 0  # Campo que existe en el modelo
    motivo: str | None = None  # Campo que existe en el modelo
    # No incluyas 'referencia' si no está en el modelo

class MovimientoOut(BaseModel):
    id: uuid.UUID
    tipo: TipoMovimiento
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    cantidad_antes: int
    cantidad_despues: int
    motivo: str | None
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)