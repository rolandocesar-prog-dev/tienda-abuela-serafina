import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import String, Numeric, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Agencia(Base):
    __tablename__ = "agencias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    sucursal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class Empleado(Base):
    __tablename__ = "empleados"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    apellido: Mapped[str] = mapped_column(String(100), nullable=False)
    ci: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_ingreso: Mapped[date] = mapped_column(Date, nullable=False)
    salario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
