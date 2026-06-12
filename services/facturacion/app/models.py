import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Numeric, Integer, DateTime, JSON, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Agencia(Base):
    __tablename__ = "agencias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    sucursal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class ContadorFactura(Base):
    """Contador atómico de facturas por agencia. Una fila por agencia."""

    __tablename__ = "contadores_factura"

    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    ultimo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Factura(Base):
    __tablename__ = "facturas"
    __table_args__ = (UniqueConstraint("agencia_id", "numero", name="uq_factura_agencia_numero"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # ej: A001-00000001
    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    venta_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    cliente_nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cliente_documento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    iva: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    fecha_emision: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    items_json: Mapped[list] = mapped_column(JSON, nullable=False)
