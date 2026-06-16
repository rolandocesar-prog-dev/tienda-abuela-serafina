import logging
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Branch, Company

logger = logging.getLogger("company.seed")

# ── UUIDs fijos ───────────────────────────────────────────────────────────────
# Coordinados con inventory-service seed para que agencias y branches
# compartan el mismo UUID sin necesitar llamadas HTTP entre servicios.

COMPANIES = [
    {
        "id": "b0000001-0000-0000-0000-000000000000",
        "nombre": "Supermercados La Canasta",
        "nit": "1001001010",
    },
    {
        "id": "b0000002-0000-0000-0000-000000000000",
        "nombre": "Supermercado El Sol",
        "nit": "2002002020",
    },
    {
        "id": "b0000003-0000-0000-0000-000000000000",
        "nombre": "Supermercado Don Pedro",
        "nit": "3003003030",
    },
]

BRANCHES = [
    # Supermercados La Canasta — Cochabamba
    {"id": "c0000001-0000-0000-0000-000000000000", "company_id": "b0000001-0000-0000-0000-000000000000", "nombre": "La Canasta Centro",      "ciudad": "Cochabamba", "direccion": "Av. Heroínas esq. Baptista"},
    {"id": "c0000002-0000-0000-0000-000000000000", "company_id": "b0000001-0000-0000-0000-000000000000", "nombre": "La Canasta Norte",       "ciudad": "Cochabamba", "direccion": "Av. América Norte 2450"},
    {"id": "c0000003-0000-0000-0000-000000000000", "company_id": "b0000001-0000-0000-0000-000000000000", "nombre": "La Canasta Sur",         "ciudad": "Cochabamba", "direccion": "Av. Blanco Galindo Km 5"},
    # Supermercado El Sol — La Paz
    {"id": "c0000004-0000-0000-0000-000000000000", "company_id": "b0000002-0000-0000-0000-000000000000", "nombre": "El Sol Centro",          "ciudad": "La Paz",     "direccion": "Calle Comercio 1234"},
    {"id": "c0000005-0000-0000-0000-000000000000", "company_id": "b0000002-0000-0000-0000-000000000000", "nombre": "El Sol Zona Este",       "ciudad": "La Paz",     "direccion": "Av. 6 de Agosto 890"},
    {"id": "c0000006-0000-0000-0000-000000000000", "company_id": "b0000002-0000-0000-0000-000000000000", "nombre": "El Sol Zona Oeste",      "ciudad": "La Paz",     "direccion": "Av. Kollasuyo 312"},
    # Supermercado Don Pedro — Santa Cruz
    {"id": "c0000007-0000-0000-0000-000000000000", "company_id": "b0000003-0000-0000-0000-000000000000", "nombre": "Don Pedro Principal",    "ciudad": "Santa Cruz", "direccion": "Av. Cristo Redentor 567"},
    {"id": "c0000008-0000-0000-0000-000000000000", "company_id": "b0000003-0000-0000-0000-000000000000", "nombre": "Don Pedro Zona Sur",     "ciudad": "Santa Cruz", "direccion": "Av. Roca y Coronado 780"},
    {"id": "c0000009-0000-0000-0000-000000000000", "company_id": "b0000003-0000-0000-0000-000000000000", "nombre": "Don Pedro Aeropuerto",   "ciudad": "Santa Cruz", "direccion": "Av. El Trompillo 1100"},
]


async def seed_companies() -> None:
    async with AsyncSessionLocal() as session:
        existe = (await session.execute(select(Company.id))).scalars().first()
        if existe:
            return

        for c in COMPANIES:
            session.add(Company(id=uuid.UUID(c["id"]), nombre=c["nombre"], nit=c["nit"]))
        await session.flush()

        for b in BRANCHES:
            session.add(Branch(
                id=uuid.UUID(b["id"]),
                company_id=uuid.UUID(b["company_id"]),
                nombre=b["nombre"],
                ciudad=b["ciudad"],
                direccion=b.get("direccion"),
            ))
        await session.commit()
        logger.info("Seed completado: 3 supermercados, 9 sucursales")
