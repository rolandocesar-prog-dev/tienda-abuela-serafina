import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Numeric, Integer, ForeignKey, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EstadoOrden(str, enum.Enum):
    pendiente = "pendiente"
    recibida = "recibida"
    cancelada = "cancelada"


class Agencia(Base):
    __tablename__ = "agencias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    sucursal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class Proveedor(Base):
    __tablename__ = "proveedores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    nit: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)


class OrdenCompra(Base):
    __tablename__ = "ordenes_compra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proveedores.id"), nullable=False)
    agencia_destino_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    estado: Mapped[EstadoOrden] = mapped_column(
        Enum(EstadoOrden, name="estado_orden"), nullable=False, default=EstadoOrden.pendiente
    )
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cuenta_por_pagar_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    items: Mapped[list["OrdenCompraItem"]] = relationship(
        back_populates="orden", cascade="all, delete-orphan", lazy="selectin"
    )


class OrdenCompraItem(Base):
    __tablename__ = "orden_compra_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ordenes_compra.id", ondelete="CASCADE"))
    producto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    orden: Mapped[OrdenCompra] = relationship(back_populates="items")
