import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    nit: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    branches: Mapped[list["Branch"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", lazy="selectin"
    )


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    ciudad: Mapped[str] = mapped_column(String(100), nullable=False)
    direccion: Mapped[str | None] = mapped_column(String(300), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    company: Mapped[Company] = relationship(back_populates="branches")
