import logging
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Agencia, Stock

logger = logging.getLogger("inventory.seed")

# ── UUIDs fijos ───────────────────────────────────────────────────────────────
# Deben coincidir exactamente con company-service/seed.py y product-service/seed.py

AGENCIAS = [
    {"id": "c0000001-0000-0000-0000-000000000000", "nombre": "La Canasta Centro",    "codigo": "S001"},
    {"id": "c0000002-0000-0000-0000-000000000000", "nombre": "La Canasta Norte",     "codigo": "S002"},
    {"id": "c0000003-0000-0000-0000-000000000000", "nombre": "La Canasta Sur",       "codigo": "S003"},
    {"id": "c0000004-0000-0000-0000-000000000000", "nombre": "El Sol Centro",        "codigo": "S004"},
    {"id": "c0000005-0000-0000-0000-000000000000", "nombre": "El Sol Zona Este",     "codigo": "S005"},
    {"id": "c0000006-0000-0000-0000-000000000000", "nombre": "El Sol Zona Oeste",    "codigo": "S006"},
    {"id": "c0000007-0000-0000-0000-000000000000", "nombre": "Don Pedro Principal",  "codigo": "S007"},
    {"id": "c0000008-0000-0000-0000-000000000000", "nombre": "Don Pedro Zona Sur",   "codigo": "S008"},
    {"id": "c0000009-0000-0000-0000-000000000000", "nombre": "Don Pedro Aeropuerto", "codigo": "S009"},
]

# Mismo orden que product-service/seed.py (a0000001 … a0000019 en hex)
PRODUCT_IDS = [
    "a0000001-0000-0000-0000-000000000000",  # 0  LAC001 Leche PIL
    "a0000002-0000-0000-0000-000000000000",  # 1  LAC002 Yogurt Delizia
    "a0000003-0000-0000-0000-000000000000",  # 2  LAC003 Queso Taquiña
    "a0000004-0000-0000-0000-000000000000",  # 3  LAC004 Mantequilla
    "a0000005-0000-0000-0000-000000000000",  # 4  LAC005 Crema de Leche
    "a0000006-0000-0000-0000-000000000000",  # 5  CAR001 Salchicha Frankfurt
    "a0000007-0000-0000-0000-000000000000",  # 6  CAR002 Jamón de Pierna
    "a0000008-0000-0000-0000-000000000000",  # 7  CAR003 Chorizo Criollo
    "a0000009-0000-0000-0000-000000000000",  # 8  CAR004 Mortadela
    "a000000a-0000-0000-0000-000000000000",  # 9  CAR005 Pechuga de Pollo
    "a000000b-0000-0000-0000-000000000000",  # 10 ABA001 Arroz Supremo
    "a000000c-0000-0000-0000-000000000000",  # 11 ABA002 Aceite Fino
    "a000000d-0000-0000-0000-000000000000",  # 12 ABA003 Azúcar Blanca
    "a000000e-0000-0000-0000-000000000000",  # 13 ABA004 Fideo Tallarín
    "a000000f-0000-0000-0000-000000000000",  # 14 ABA005 Harina de Trigo
    "a0000010-0000-0000-0000-000000000000",  # 15 BEB001 Coca Cola 2L
    "a0000011-0000-0000-0000-000000000000",  # 16 BEB002 Agua Vital
    "a0000012-0000-0000-0000-000000000000",  # 17 BEB003 Jugo Naranja
    "a0000013-0000-0000-0000-000000000000",  # 18 BEB004 Cerveza Paceña
    "a0000014-0000-0000-0000-000000000000",  # 19 BEB005 Néctar Watts
    "a0000015-0000-0000-0000-000000000000",  # 20 LIM001 Detergente Ariel
    "a0000016-0000-0000-0000-000000000000",  # 21 LIM002 Jabón Bolivar
    "a0000017-0000-0000-0000-000000000000",  # 22 LIM003 Lavavajillas
    "a0000018-0000-0000-0000-000000000000",  # 23 LIM004 Papel Higiénico
    "a0000019-0000-0000-0000-000000000000",  # 24 LIM005 Cloro Olimpia
]

# Pares (branch_idx, prod_idx) con stock crítico para demo
_LOW = {
    (0, 3): 8,   (0, 18): 5,              # La Canasta Centro
    (1, 9): 6,   (1, 22): 7,              # La Canasta Norte
    (2, 0): 5,   (2, 14): 8,              # La Canasta Sur
    (3, 6): 9,   (3, 20): 4,              # El Sol Centro
    (4, 11): 7,                           # El Sol Zona Este
    (5, 2): 6,   (5, 17): 8,              # El Sol Zona Oeste
    (6, 5): 5,   (6, 23): 7,              # Don Pedro Principal
    (7, 8): 9,   (7, 15): 4,              # Don Pedro Zona Sur
    (8, 1): 6,   (8, 13): 5, (8, 24): 8, # Don Pedro Aeropuerto
}

# Cantidades base por sucursal (varía para que la demo sea realista)
_BASES = [90, 65, 45, 80, 55, 40, 75, 50, 30]


def _qty(branch_idx: int, prod_idx: int) -> int:
    if (branch_idx, prod_idx) in _LOW:
        return _LOW[(branch_idx, prod_idx)]
    base = _BASES[branch_idx]
    # Variación orgánica: cada producto difiere ±10 unidades
    variation = (prod_idx * 7 + branch_idx * 3) % 21
    return max(15, base - 10 + variation)


async def seed_data() -> None:
    async with AsyncSessionLocal() as session:
        existente = (await session.execute(select(Agencia.id))).scalars().first()
        if existente:
            return

        # Crear agencias
        for ag in AGENCIAS:
            uid = uuid.UUID(ag["id"])
            session.add(Agencia(
                id=uid,
                sucursal_id=uid,
                nombre=ag["nombre"],
                codigo=ag["codigo"],
            ))
        await session.flush()

        # Stock inicial: 9 sucursales × 25 productos = 225 entradas
        for b_idx, ag in enumerate(AGENCIAS):
            agencia_id = uuid.UUID(ag["id"])
            for p_idx, prod_id in enumerate(PRODUCT_IDS):
                session.add(Stock(
                    agencia_id=agencia_id,
                    producto_id=uuid.UUID(prod_id),
                    cantidad=_qty(b_idx, p_idx),
                ))

        await session.commit()
        logger.info("Seed completado: 9 agencias, 225 entradas de stock")
