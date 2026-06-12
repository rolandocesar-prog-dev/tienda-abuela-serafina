"""Datos semilla compartidos: sucursales y agencias de la cadena.

Estos UUIDs son IDENTICOS en todos los servicios que manejan agencia_id.
Si cambias uno, hay que cambiarlo en TODOS los servicios. Coordinen.

Facturación además inicializa un ContadorFactura por agencia (ultimo=0)
para que el SELECT FOR UPDATE de la numeración correlativa siempre
encuentre la fila que tiene que bloquear.
"""
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Agencia, ContadorFactura

SUCURSALES = [
    {"id": "550e8400-e29b-41d4-a716-446655440001", "nombre": "Sucursal La Paz",     "ciudad": "La Paz"},
    {"id": "550e8400-e29b-41d4-a716-446655440002", "nombre": "Sucursal Santa Cruz", "ciudad": "Santa Cruz"},
    {"id": "550e8400-e29b-41d4-a716-446655440003", "nombre": "Sucursal Cochabamba", "ciudad": "Cochabamba"},
]

AGENCIAS = [
    {"id": "660e8400-e29b-41d4-a716-446655440001", "sucursal_id": "550e8400-e29b-41d4-a716-446655440001", "nombre": "Agencia Centro La Paz",  "codigo": "A001"},
    {"id": "660e8400-e29b-41d4-a716-446655440002", "sucursal_id": "550e8400-e29b-41d4-a716-446655440001", "nombre": "Agencia Sopocachi",      "codigo": "A002"},
    {"id": "660e8400-e29b-41d4-a716-446655440003", "sucursal_id": "550e8400-e29b-41d4-a716-446655440002", "nombre": "Agencia Equipetrol",     "codigo": "A003"},
    {"id": "660e8400-e29b-41d4-a716-446655440004", "sucursal_id": "550e8400-e29b-41d4-a716-446655440002", "nombre": "Agencia Norte",          "codigo": "A004"},
    {"id": "660e8400-e29b-41d4-a716-446655440005", "sucursal_id": "550e8400-e29b-41d4-a716-446655440003", "nombre": "Agencia Centro Cocha",   "codigo": "A005"},
    {"id": "660e8400-e29b-41d4-a716-446655440006", "sucursal_id": "550e8400-e29b-41d4-a716-446655440003", "nombre": "Agencia Sur",            "codigo": "A006"},
]


async def seed_data() -> None:
    """Inserta agencias y contadores de factura si la tabla está vacía. Idempotente."""
    async with AsyncSessionLocal() as session:
        existentes = (await session.execute(select(Agencia.id))).scalars().all()
        if existentes:
            return
        for a in AGENCIAS:
            agencia_id = uuid.UUID(a["id"])
            session.add(Agencia(
                id=agencia_id,
                sucursal_id=uuid.UUID(a["sucursal_id"]),
                nombre=a["nombre"],
                codigo=a["codigo"],
            ))
            session.add(ContadorFactura(agencia_id=agencia_id, ultimo=0))
        await session.commit()
