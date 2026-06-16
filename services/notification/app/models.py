"""
Modelos del Notification Service.

Tabla `notifications` con los 4 campos que pide el PDF:
- fecha, cliente, tipo, contenido

Más campos auxiliares para idempotencia y trazabilidad.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, JSON, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_notification_event_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    cliente: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)  # email|sms|whatsapp|push
    contenido: Mapped[str] = mapped_column(String(1000), nullable=False)

    # Auxiliares (trazabilidad e idempotencia)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
