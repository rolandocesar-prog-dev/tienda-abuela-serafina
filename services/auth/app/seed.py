import logging
import uuid

import bcrypt as _bcrypt
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Rol, Usuario

logger = logging.getLogger("auth.seed")

# UUIDs coordinados con company-service/seed.py y inventory-service/seed.py
VENDEDORES_SEED = [
    {"username": "canasta.centro",      "email": "canasta.centro@abuelaserafina.com",      "sucursal_id": "c0000001-0000-0000-0000-000000000000"},
    {"username": "canasta.norte",       "email": "canasta.norte@abuelaserafina.com",       "sucursal_id": "c0000002-0000-0000-0000-000000000000"},
    {"username": "canasta.sur",         "email": "canasta.sur@abuelaserafina.com",         "sucursal_id": "c0000003-0000-0000-0000-000000000000"},
    {"username": "elsol.centro",        "email": "elsol.centro@abuelaserafina.com",        "sucursal_id": "c0000004-0000-0000-0000-000000000000"},
    {"username": "elsol.este",          "email": "elsol.este@abuelaserafina.com",          "sucursal_id": "c0000005-0000-0000-0000-000000000000"},
    {"username": "elsol.oeste",         "email": "elsol.oeste@abuelaserafina.com",         "sucursal_id": "c0000006-0000-0000-0000-000000000000"},
    {"username": "donpedro.principal",  "email": "donpedro.principal@abuelaserafina.com",  "sucursal_id": "c0000007-0000-0000-0000-000000000000"},
    {"username": "donpedro.sur",        "email": "donpedro.sur@abuelaserafina.com",        "sucursal_id": "c0000008-0000-0000-0000-000000000000"},
    {"username": "donpedro.aeropuerto", "email": "donpedro.aeropuerto@abuelaserafina.com", "sucursal_id": "c0000009-0000-0000-0000-000000000000"},
]


async def seed_admin() -> None:
    async with AsyncSessionLocal() as session:
        # ── Admin ─────────────────────────────────────────────────────────────
        existe = (await session.execute(
            select(Usuario).where(Usuario.username == "admin")
        )).scalar_one_or_none()

        if existe is None:
            session.add(Usuario(
                username="admin",
                email="admin@abuelaserafina.com",
                password_hash=_bcrypt.hashpw(b"admin123", _bcrypt.gensalt()).decode(),
                rol=Rol.administrador,
                sucursal_id=None,
            ))
            logger.info("Usuario admin creado — credenciales: admin / admin123")

        # ── Vendedores ────────────────────────────────────────────────────────
        for v in VENDEDORES_SEED:
            existe_v = (await session.execute(
                select(Usuario).where(Usuario.username == v["username"])
            )).scalar_one_or_none()

            if existe_v is None:
                session.add(Usuario(
                    username=v["username"],
                    email=v["email"],
                    password_hash=_bcrypt.hashpw(b"vendedor123", _bcrypt.gensalt()).decode(),
                    rol=Rol.vendedor,
                    sucursal_id=uuid.UUID(v["sucursal_id"]),
                ))
                logger.info("Vendedor creado: %s → sucursal %s", v["username"], v["sucursal_id"])

        await session.commit()
