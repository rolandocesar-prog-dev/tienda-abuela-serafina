from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Base declarativa común a todos los modelos del servicio."""


engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """Dependencia FastAPI: abre una sesión async por request."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Crea todas las tablas declaradas. Llamado desde el lifespan al iniciar."""
    # Importar modelos aquí asegura que estén registrados en Base.metadata
    from app import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
