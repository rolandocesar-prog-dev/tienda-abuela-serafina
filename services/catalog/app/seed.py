import logging
from decimal import Decimal
from sqlalchemy.future import select

from app.database import AsyncSessionLocal
from app.models import Producto

# Configuramos el logger para ver los mensajes en la consola de Docker
logger = logging.getLogger("catalog.seed")

async def seed_data() -> None:
    """Carga productos iniciales automáticamente solo si la tabla está vacía."""
    try:
        async with AsyncSessionLocal() as session:
            # 1. Guardia de seguridad: ¿Ya hay productos?
            resultado = await session.execute(select(Producto).limit(1))
            if resultado.scalar_one_or_none() is not None:
                logger.info("Los datos semilla ya existen. Omitiendo carga inicial.")
                return

            # 2. Si está vacío, preparamos nuestros productos iniciales
            productos_iniciales = [
                Producto(
                    codigo="PROD-001",
                    nombre="Arroz Extra Grado A",
                    descripcion="Arroz blanco seleccionado de primera calidad.",
                    categoria="Granos",
                    unidad_medida="kg",
                    precio_base=Decimal("12.50")
                ),
                Producto(
                    codigo="PROD-002",
                    nombre="Aceite de Girasol Fino",
                    descripcion="Aceite vegetal 100% puro, botella de 1 litro.",
                    categoria="Aceites",
                    unidad_medida="lt",
                    precio_base=Decimal("15.90")
                ),
                Producto(
                    codigo="PROD-003",
                    nombre="Azúcar Blanca Refinada",
                    descripcion="Azúcar blanca especial para uso diario.",
                    categoria="Endulzantes",
                    unidad_medida="kg",
                    precio_base=Decimal("8.00")
                )
            ]

            # 3. Guardamos todo en bloque (bulk insert)
            session.add_all(productos_iniciales)
            await session.commit()
            logger.info("¡Datos semilla de productos cargados exitosamente!")

    except Exception as e:
        # Si algo sale mal (ej. la base de datos no está lista), atrapamos el error
        # para que el microservicio no colapse y siga funcionando.
        logger.error(f"Error al cargar los datos semilla: {e}")