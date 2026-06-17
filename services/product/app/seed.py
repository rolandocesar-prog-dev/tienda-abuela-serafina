import logging
import uuid
from decimal import Decimal

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Producto

logger = logging.getLogger("product.seed")

# UUIDs fijos — coordinados con inventory-service seed
PRODUCTOS = [
    # ── Lácteos ──────────────────────────────────────────────────────────────
    {"id": "a0000001-0000-0000-0000-000000000000", "codigo": "LAC001", "nombre": "Leche Entera PIL 1L",          "categoria": "Lácteos",            "unidad_medida": "unidad",  "precio_base": Decimal("8.50"),  "descripcion": "Leche entera pasteurizada PIL 1 litro"},
    {"id": "a0000002-0000-0000-0000-000000000000", "codigo": "LAC002", "nombre": "Yogurt Natural Delizia 1kg",   "categoria": "Lácteos",            "unidad_medida": "unidad",  "precio_base": Decimal("18.00"), "descripcion": "Yogurt natural sin azúcar Delizia 1kg"},
    {"id": "a0000003-0000-0000-0000-000000000000", "codigo": "LAC003", "nombre": "Queso Taquiña 500g",           "categoria": "Lácteos",            "unidad_medida": "unidad",  "precio_base": Decimal("22.00"), "descripcion": "Queso fresco Taquiña 500 gramos"},
    {"id": "a0000004-0000-0000-0000-000000000000", "codigo": "LAC004", "nombre": "Mantequilla Pil 200g",         "categoria": "Lácteos",            "unidad_medida": "unidad",  "precio_base": Decimal("14.50"), "descripcion": "Mantequilla sin sal Pil 200g"},
    {"id": "a0000005-0000-0000-0000-000000000000", "codigo": "LAC005", "nombre": "Crema de Leche 250ml",         "categoria": "Lácteos",            "unidad_medida": "unidad",  "precio_base": Decimal("11.00"), "descripcion": "Crema de leche para cocina 250ml"},
    # ── Carnes y Embutidos ────────────────────────────────────────────────────
    {"id": "a0000006-0000-0000-0000-000000000000", "codigo": "CAR001", "nombre": "Salchicha Frankfurt 500g",     "categoria": "Carnes y Embutidos", "unidad_medida": "paquete", "precio_base": Decimal("28.00"), "descripcion": "Salchichas Frankfurt estilo alemán 500g"},
    {"id": "a0000007-0000-0000-0000-000000000000", "codigo": "CAR002", "nombre": "Jamón de Pierna 250g",         "categoria": "Carnes y Embutidos", "unidad_medida": "paquete", "precio_base": Decimal("24.00"), "descripcion": "Jamón cocido de pierna rebanado 250g"},
    {"id": "a0000008-0000-0000-0000-000000000000", "codigo": "CAR003", "nombre": "Chorizo Criollo 1kg",          "categoria": "Carnes y Embutidos", "unidad_medida": "kg",      "precio_base": Decimal("45.00"), "descripcion": "Chorizo criollo boliviano al kilo"},
    {"id": "a0000009-0000-0000-0000-000000000000", "codigo": "CAR004", "nombre": "Mortadela Rebanada 200g",      "categoria": "Carnes y Embutidos", "unidad_medida": "paquete", "precio_base": Decimal("16.00"), "descripcion": "Mortadela italiana rebanada 200g"},
    {"id": "a000000a-0000-0000-0000-000000000000", "codigo": "CAR005", "nombre": "Pechuga de Pollo 1kg",         "categoria": "Carnes y Embutidos", "unidad_medida": "kg",      "precio_base": Decimal("38.00"), "descripcion": "Pechuga de pollo fresca sin hueso 1kg"},
    # ── Abarrotes ─────────────────────────────────────────────────────────────
    {"id": "a000000b-0000-0000-0000-000000000000", "codigo": "ABA001", "nombre": "Arroz Supremo 1kg",            "categoria": "Abarrotes",          "unidad_medida": "bolsa",   "precio_base": Decimal("12.00"), "descripcion": "Arroz grano largo Supremo 1kg"},
    {"id": "a000000c-0000-0000-0000-000000000000", "codigo": "ABA002", "nombre": "Aceite Fino 1L",               "categoria": "Abarrotes",          "unidad_medida": "botella", "precio_base": Decimal("15.50"), "descripcion": "Aceite vegetal refinado Fino 1 litro"},
    {"id": "a000000d-0000-0000-0000-000000000000", "codigo": "ABA003", "nombre": "Azúcar Blanca 1kg",            "categoria": "Abarrotes",          "unidad_medida": "bolsa",   "precio_base": Decimal("8.00"),  "descripcion": "Azúcar blanca refinada 1kg"},
    {"id": "a000000e-0000-0000-0000-000000000000", "codigo": "ABA004", "nombre": "Fideo Tallarín 500g",          "categoria": "Abarrotes",          "unidad_medida": "paquete", "precio_base": Decimal("7.50"),  "descripcion": "Fideo tallarín de trigo 500g"},
    {"id": "a000000f-0000-0000-0000-000000000000", "codigo": "ABA005", "nombre": "Harina de Trigo 1kg",          "categoria": "Abarrotes",          "unidad_medida": "bolsa",   "precio_base": Decimal("9.00"),  "descripcion": "Harina de trigo todo uso 1kg"},
    # ── Bebidas ───────────────────────────────────────────────────────────────
    {"id": "a0000010-0000-0000-0000-000000000000", "codigo": "BEB001", "nombre": "Coca Cola 2L",                 "categoria": "Bebidas",            "unidad_medida": "botella", "precio_base": Decimal("13.00"), "descripcion": "Coca Cola original 2 litros"},
    {"id": "a0000011-0000-0000-0000-000000000000", "codigo": "BEB002", "nombre": "Agua Vital 600ml",             "categoria": "Bebidas",            "unidad_medida": "botella", "precio_base": Decimal("4.50"),  "descripcion": "Agua mineral sin gas Vital 600ml"},
    {"id": "a0000012-0000-0000-0000-000000000000", "codigo": "BEB003", "nombre": "Jugo de Naranja Naturale 1L",  "categoria": "Bebidas",            "unidad_medida": "botella", "precio_base": Decimal("16.00"), "descripcion": "Jugo de naranja 100% natural 1 litro"},
    {"id": "a0000013-0000-0000-0000-000000000000", "codigo": "BEB004", "nombre": "Cerveza Paceña 620ml",         "categoria": "Bebidas",            "unidad_medida": "botella", "precio_base": Decimal("12.00"), "descripcion": "Cerveza Paceña botella 620ml"},
    {"id": "a0000014-0000-0000-0000-000000000000", "codigo": "BEB005", "nombre": "Néctar Watts Durazno 1L",      "categoria": "Bebidas",            "unidad_medida": "caja",    "precio_base": Decimal("11.50"), "descripcion": "Néctar de durazno Watts 1 litro"},
    # ── Limpieza y Hogar ──────────────────────────────────────────────────────
    {"id": "a0000015-0000-0000-0000-000000000000", "codigo": "LIM001", "nombre": "Detergente Ariel 1kg",         "categoria": "Limpieza y Hogar",   "unidad_medida": "bolsa",   "precio_base": Decimal("32.00"), "descripcion": "Detergente en polvo Ariel 1kg"},
    {"id": "a0000016-0000-0000-0000-000000000000", "codigo": "LIM002", "nombre": "Jabón Bolivar 3 unidades",     "categoria": "Limpieza y Hogar",   "unidad_medida": "paquete", "precio_base": Decimal("9.50"),  "descripcion": "Jabón de lavar Bolivar pack x3"},
    {"id": "a0000017-0000-0000-0000-000000000000", "codigo": "LIM003", "nombre": "Lavavajillas Don Limpio 500g", "categoria": "Limpieza y Hogar",   "unidad_medida": "unidad",  "precio_base": Decimal("14.00"), "descripcion": "Lavavajillas en crema Don Limpio 500g"},
    {"id": "a0000018-0000-0000-0000-000000000000", "codigo": "LIM004", "nombre": "Papel Higiénico Elite x4",     "categoria": "Limpieza y Hogar",   "unidad_medida": "paquete", "precio_base": Decimal("18.50"), "descripcion": "Papel higiénico doble hoja Elite pack x4"},
    {"id": "a0000019-0000-0000-0000-000000000000", "codigo": "LIM005", "nombre": "Cloro Olimpia 1L",             "categoria": "Limpieza y Hogar",   "unidad_medida": "botella", "precio_base": Decimal("8.00"),  "descripcion": "Cloro desinfectante Olimpia 1 litro"},
]


async def seed_data() -> None:
    async with AsyncSessionLocal() as session:
        existentes = (await session.execute(select(Producto.id))).scalars().first()
        if existentes:
            return
        for p in PRODUCTOS:
            data = {k: v for k, v in p.items() if k != "id"}
            session.add(Producto(id=uuid.UUID(p["id"]), **data))
        await session.commit()
        logger.info("Seed completado: %d productos en 5 categorías", len(PRODUCTOS))
