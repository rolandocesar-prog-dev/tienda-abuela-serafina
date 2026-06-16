import logging

import bcrypt as _bcrypt
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Rol, Usuario

logger = logging.getLogger("auth.seed")


async def seed_admin() -> None:
    """Crea el usuario administrador por defecto si no existe."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Usuario).where(Usuario.username == "admin"))
        if result.scalar_one_or_none() is not None:
            return
        admin = Usuario(
            username="admin",
            email="admin@abuelaserafina.com",
            password_hash=_bcrypt.hashpw("Admin1234!".encode(), _bcrypt.gensalt()).decode(),
            rol=Rol.administrador,
            sucursal_id=None,
        )
        session.add(admin)
        await session.commit()
        logger.info("Usuario admin creado — credenciales: admin / Admin1234!")
