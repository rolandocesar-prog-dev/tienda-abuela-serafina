import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: uuid.UUID
    fecha: datetime
    cliente: str | None
    tipo: str
    contenido: str
    event_id: uuid.UUID
    event_type: str
    source: str

    model_config = ConfigDict(from_attributes=True)
