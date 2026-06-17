import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Numeric, Integer, ForeignKey, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EstadoVenta(str, enum.Enum):
    pendiente = "pendiente"
    pagada = "pagada"
    cancelada = "cancelada"


class Agencia(Base):
    """Lookup table de agencias — poblada en lifespan vía seed.py."""

    __tablename__ = "agencias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    sucursal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    cliente_nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cliente_documento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    estado: Mapped[EstadoVenta] = mapped_column(
        Enum(EstadoVenta, name="estado_venta"), nullable=False, default=EstadoVenta.pendiente
    )
    metodo_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="efectivo")
    factura_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    pago_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    items: Mapped[list["VentaItem"]] = relationship(
        back_populates="venta", cascade="all, delete-orphan", lazy="selectin"
    )


class VentaItem(Base):
    __tablename__ = "venta_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    producto_nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    venta: Mapped[Venta] = relationship(back_populates="items")
