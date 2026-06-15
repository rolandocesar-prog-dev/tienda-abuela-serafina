"""Datos semilla para el servicio de compras: agencias y proveedores."""
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Agencia, Proveedor

# ========== AGENCIAS (IDÉNTICAS A OTROS SERVICIOS) ==========
AGENCIAS = [
    {"id": "11111111-1111-1111-1111-111111111111", "sucursal_id": "11111111-1111-1111-1111-111111111111", "nombre": "Agencia Centro La Paz",  "codigo": "A001"},
    {"id": "11111111-1111-1111-1111-222222222222", "sucursal_id": "11111111-1111-1111-1111-111111111111", "nombre": "Agencia Sopocachi",      "codigo": "A002"},
    {"id": "11111111-1111-1111-1111-333333333333", "sucursal_id": "11111111-1111-1111-1111-222222222222", "nombre": "Agencia Equipetrol",     "codigo": "A003"},
    {"id": "11111111-1111-1111-1111-444444444444", "sucursal_id": "11111111-1111-1111-1111-222222222222", "nombre": "Agencia Norte",          "codigo": "A004"},
    {"id": "11111111-1111-1111-1111-555555555555", "sucursal_id": "11111111-1111-1111-1111-333333333333", "nombre": "Agencia Centro Cocha",   "codigo": "A005"},
    {"id": "11111111-1111-1111-1111-666666666666", "sucursal_id": "11111111-1111-1111-1111-333333333333", "nombre": "Agencia Sur",            "codigo": "A006"},
]

# ========== PROVEEDORES DE EJEMPLO ==========
PROVEEDORES = [
    {
        "id": "22222222-2222-2222-2222-111111111111",
        "nombre": "Distribuidora de Alimentos S.A.",
        "nit": "1234567890",
        "telefono": "2-1234567",
        "email": "ventas@distribuidora.com.bo"
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "nombre": "Bebidas del Sur",
        "nit": "2345678901",
        "telefono": "3-7654321",
        "email": "pedidos@bebidasdelsur.bo"
    },
    {
        "id": "22222222-2222-2222-2222-333333333333",
        "nombre": "Lácteos La Vaquita",
        "nit": "3456789012",
        "telefono": "4-9876543",
        "email": "ventas@lacteoslavaquita.bo"
    },
    {
        "id": "22222222-2222-2222-2222-444444444444",
        "nombre": "Carnes Premium",
        "nit": "4567890123",
        "telefono": "5-4567890",
        "email": "carnes@premium.bo"
    },
    {
        "id": "22222222-2222-2222-2222-555555555555",
        "nombre": "Verduras y Frutas El Campo",
        "nit": "5678901234",
        "telefono": "6-3456789",
        "email": "pedidos@elcampo.bo"
    },
    {
        "id": "22222222-2222-2222-2222-666666666666",
        "nombre": "Limpieza Total",
        "nit": "6789012345",
        "telefono": "7-2345678",
        "email": "ventas@limpiezatotal.bo"
    },
    {
        "id": "22222222-2222-2222-2222-777777777777",
        "nombre": "Higiene Personal",
        "nit": "7890123456",
        "telefono": "8-1234567",
        "email": "contacto@higienepersonal.bo"
    },
    {
        "id": "22222222-2222-2222-2222-888888888888",
        "nombre": "Electrodomésticos Bolivianos",
        "nit": "8901234567",
        "telefono": "9-8765432",
        "email": "ventas@electrobol.bo"
    },
]


async def seed_data() -> None:
    """Inserta agencias y proveedores si las tablas están vacías. Idempotente."""
    async with AsyncSessionLocal() as session:
        # ----- AGENCIAS -----
        existentes_agencias = (await session.execute(select(Agencia.id))).scalars().all()
        if not existentes_agencias:
            print("🌱 Seed de compras: Insertando agencias...")
            for a in AGENCIAS:
                session.add(Agencia(
                    id=uuid.UUID(a["id"]),
                    sucursal_id=uuid.UUID(a["sucursal_id"]),
                    nombre=a["nombre"],
                    codigo=a["codigo"],
                ))
            await session.flush()
            print(f"   ✅ {len(AGENCIAS)} agencias insertadas")
        else:
            print("📊 Seed de compras: Agencias ya existen, omitiendo...")

        # ----- PROVEEDORES -----
        existentes_proveedores = (await session.execute(select(Proveedor.id))).scalars().all()
        if not existentes_proveedores:
            print("🌱 Seed de compras: Insertando proveedores...")
            for p in PROVEEDORES:
                session.add(Proveedor(
                    id=uuid.UUID(p["id"]),
                    nombre=p["nombre"],
                    nit=p["nit"],
                    telefono=p["telefono"],
                    email=p["email"],
                ))
            await session.commit()
            print(f"   ✅ {len(PROVEEDORES)} proveedores insertados")
        else:
            print("📊 Seed de compras: Proveedores ya existen, omitiendo...")