"""Seed idempotente de 50 clientes bolivianos para la defensa."""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Customer

logger = logging.getLogger(__name__)


# 50 clientes con nombres bolivianos típicos.
# CI bolivianos (7-8 dígitos), NIT empresas (10 dígitos terminados en "010" / "012" / etc.)
# Teléfonos: +591 7xxxxxxx (Tigo/Entel/Viva)
# Puntos: distribución realista — la mayoría con pocos, algunos clientes recurrentes con muchos.
CLIENTES_SEED: list[dict] = [
    # Clientes con CI personal — La Paz
    {"id": "d0000001-0000-0000-0000-000000000000", "nombre": "Juanito Pérez Mamani",        "ci_nit": "5050505",   "email": "juanito.perez@gmail.com",      "telefono": "+591 70123456", "puntos_acumulados": 120},
    {"id": "d0000002-0000-0000-0000-000000000000", "nombre": "María Elena Quispe",          "ci_nit": "6789012",   "email": "maria.quispe@hotmail.com",     "telefono": "+591 71234567", "puntos_acumulados": 350},
    {"id": "d0000003-0000-0000-0000-000000000000", "nombre": "Carlos Andrés Rojas",         "ci_nit": "4567890",   "email": "carlos.rojas@yahoo.com",       "telefono": "+591 72345678", "puntos_acumulados": 75},
    {"id": "d0000004-0000-0000-0000-000000000000", "nombre": "Ana Lucía Choque",            "ci_nit": "8901234",   "email": "ana.choque@gmail.com",         "telefono": "+591 73456789", "puntos_acumulados": 0},
    {"id": "d0000005-0000-0000-0000-000000000000", "nombre": "Luis Fernando Condori",       "ci_nit": "3456789",   "email": "luis.condori@outlook.com",     "telefono": "+591 74567890", "puntos_acumulados": 50},

    # Cochabamba
    {"id": "d0000006-0000-0000-0000-000000000000", "nombre": "Patricia Vargas Romero",      "ci_nit": "7654321",   "email": "patty.vargas@gmail.com",       "telefono": "+591 75678901", "puntos_acumulados": 200},
    {"id": "d0000007-0000-0000-0000-000000000000", "nombre": "Roberto Mendoza López",       "ci_nit": "2345678",   "email": "roberto.mendoza@yahoo.com",    "telefono": "+591 76789012", "puntos_acumulados": 15},
    {"id": "d0000008-0000-0000-0000-000000000000", "nombre": "Gladys Flores Aliaga",        "ci_nit": "9012345",   "email": "gladys.flores@hotmail.com",    "telefono": "+591 77890123", "puntos_acumulados": 480},
    {"id": "d0000009-0000-0000-0000-000000000000", "nombre": "Diego Antonio Salazar",       "ci_nit": "1234567",   "email": "diego.salazar@gmail.com",      "telefono": "+591 78901234", "puntos_acumulados": 90},
    {"id": "d000000a-0000-0000-0000-000000000000", "nombre": "Verónica Apaza Huanca",       "ci_nit": "6543210",   "email": None,                            "telefono": "+591 79012345", "puntos_acumulados": 0},

    # Santa Cruz
    {"id": "d000000b-0000-0000-0000-000000000000", "nombre": "Jorge Eduardo Suárez",        "ci_nit": "8765432",   "email": "jorge.suarez@gmail.com",       "telefono": "+591 70234567", "puntos_acumulados": 310},
    {"id": "d000000c-0000-0000-0000-000000000000", "nombre": "Carmen Rosa Justiniano",      "ci_nit": "3210987",   "email": "carmen.justiniano@gmail.com",  "telefono": "+591 71345678", "puntos_acumulados": 165},
    {"id": "d000000d-0000-0000-0000-000000000000", "nombre": "Marcelo Fabián Roca",         "ci_nit": "5432109",   "email": "marcelo.roca@outlook.com",     "telefono": "+591 72456789", "puntos_acumulados": 25},
    {"id": "d000000e-0000-0000-0000-000000000000", "nombre": "Silvana Banzer Méndez",       "ci_nit": "9876543",   "email": "silvana.banzer@hotmail.com",   "telefono": "+591 73567890", "puntos_acumulados": 220},
    {"id": "d000000f-0000-0000-0000-000000000000", "nombre": "Hernán Vaca Diez",            "ci_nit": "4321098",   "email": None,                            "telefono": "+591 74678901", "puntos_acumulados": 60},

    # Oruro
    {"id": "d0000010-0000-0000-0000-000000000000", "nombre": "Wilma Catacora Pinto",        "ci_nit": "7890123",   "email": "wilma.catacora@gmail.com",     "telefono": "+591 75789012", "puntos_acumulados": 145},
    {"id": "d0000011-0000-0000-0000-000000000000", "nombre": "Edgar Mauricio Llanos",       "ci_nit": "2109876",   "email": "edgar.llanos@yahoo.com",       "telefono": "+591 76890123", "puntos_acumulados": 30},
    {"id": "d0000012-0000-0000-0000-000000000000", "nombre": "Sonia Beatriz Ticona",        "ci_nit": "1098765",   "email": "sonia.ticona@gmail.com",       "telefono": "+591 77901234", "puntos_acumulados": 195},

    # Potosí
    {"id": "d0000013-0000-0000-0000-000000000000", "nombre": "Ricardo Andrés Calvimontes",  "ci_nit": "6109876",   "email": "ricardo.calvimontes@gmail.com","telefono": "+591 78012345", "puntos_acumulados": 80},
    {"id": "d0000014-0000-0000-0000-000000000000", "nombre": "Isabel Cristina Tola",        "ci_nit": "3098765",   "email": None,                            "telefono": "+591 79123456", "puntos_acumulados": 0},
    {"id": "d0000015-0000-0000-0000-000000000000", "nombre": "Gonzalo Patiño Olmos",        "ci_nit": "5098765",   "email": "gonzalo.patino@hotmail.com",   "telefono": "+591 70345678", "puntos_acumulados": 250},

    # Tarija
    {"id": "d0000016-0000-0000-0000-000000000000", "nombre": "Liliana Aramayo Vaca",        "ci_nit": "4098765",   "email": "liliana.aramayo@gmail.com",    "telefono": "+591 71456789", "puntos_acumulados": 175},
    {"id": "d0000017-0000-0000-0000-000000000000", "nombre": "Pablo César Echazú",          "ci_nit": "8098765",   "email": "pablo.echazu@outlook.com",     "telefono": "+591 72567890", "puntos_acumulados": 55},
    {"id": "d0000018-0000-0000-0000-000000000000", "nombre": "Mónica Gareca Salinas",       "ci_nit": "7098765",   "email": "monica.gareca@gmail.com",      "telefono": "+591 73678901", "puntos_acumulados": 410},

    # Sucre
    {"id": "d0000019-0000-0000-0000-000000000000", "nombre": "Andrés Calancha Loayza",      "ci_nit": "2098765",   "email": "andres.calancha@gmail.com",    "telefono": "+591 74789012", "puntos_acumulados": 100},
    {"id": "d000001a-0000-0000-0000-000000000000", "nombre": "Cecilia Burgoa Mercado",      "ci_nit": "1209876",   "email": "cecilia.burgoa@yahoo.com",     "telefono": "+591 75890123", "puntos_acumulados": 285},

    # El Alto
    {"id": "d000001b-0000-0000-0000-000000000000", "nombre": "Eustaquio Mamani Aruquipa",   "ci_nit": "6210987",   "email": None,                            "telefono": "+591 76901234", "puntos_acumulados": 20},
    {"id": "d000001c-0000-0000-0000-000000000000", "nombre": "Florencia Limachi Ramos",     "ci_nit": "5210987",   "email": "florencia.limachi@gmail.com",  "telefono": "+591 77012345", "puntos_acumulados": 130},
    {"id": "d000001d-0000-0000-0000-000000000000", "nombre": "Severo Yujra Marca",          "ci_nit": "4210987",   "email": None,                            "telefono": "+591 78123456", "puntos_acumulados": 5},
    {"id": "d000001e-0000-0000-0000-000000000000", "nombre": "Hilaria Tarqui Callisaya",    "ci_nit": "3210988",   "email": "hilaria.tarqui@hotmail.com",   "telefono": "+591 79234567", "puntos_acumulados": 95},

    # Más clientes variados
    {"id": "d000001f-0000-0000-0000-000000000000", "nombre": "Esteban Camacho Iriarte",     "ci_nit": "9210987",   "email": "esteban.camacho@gmail.com",    "telefono": "+591 70456789", "puntos_acumulados": 40},
    {"id": "d0000020-0000-0000-0000-000000000000", "nombre": "Rosa María Ferrufino",        "ci_nit": "8210987",   "email": "rosa.ferrufino@gmail.com",     "telefono": "+591 71567890", "puntos_acumulados": 360},
    {"id": "d0000021-0000-0000-0000-000000000000", "nombre": "Walter Heriberto Coca",       "ci_nit": "7210987",   "email": "walter.coca@yahoo.com",        "telefono": "+591 72678901", "puntos_acumulados": 10},
    {"id": "d0000022-0000-0000-0000-000000000000", "nombre": "Norah Antezana Vargas",       "ci_nit": "6321098",   "email": "norah.antezana@gmail.com",     "telefono": "+591 73789012", "puntos_acumulados": 215},
    {"id": "d0000023-0000-0000-0000-000000000000", "nombre": "Federico Sandoval Encinas",   "ci_nit": "5321098",   "email": None,                            "telefono": "+591 74890123", "puntos_acumulados": 70},
    {"id": "d0000024-0000-0000-0000-000000000000", "nombre": "Beatriz Pacheco Saavedra",    "ci_nit": "4321099",   "email": "beatriz.pacheco@hotmail.com",  "telefono": "+591 75901234", "puntos_acumulados": 180},
    {"id": "d0000025-0000-0000-0000-000000000000", "nombre": "Iván Quezada Camargo",        "ci_nit": "3432109",   "email": "ivan.quezada@gmail.com",       "telefono": "+591 76012345", "puntos_acumulados": 0},
    {"id": "d0000026-0000-0000-0000-000000000000", "nombre": "Daniela Pérez Velasco",       "ci_nit": "2432109",   "email": "daniela.perez@outlook.com",    "telefono": "+591 77123456", "puntos_acumulados": 295},
    {"id": "d0000027-0000-0000-0000-000000000000", "nombre": "Mauricio Linares Crespo",     "ci_nit": "1432109",   "email": "mauricio.linares@gmail.com",   "telefono": "+591 78234567", "puntos_acumulados": 65},
    {"id": "d0000028-0000-0000-0000-000000000000", "nombre": "Tatiana Espinoza Soliz",      "ci_nit": "9432108",   "email": "tatiana.espinoza@gmail.com",   "telefono": "+591 79345678", "puntos_acumulados": 155},

    # NITs (empresas / comercios)
    {"id": "d0000029-0000-0000-0000-000000000000", "nombre": "Pensión Doña Carmen S.R.L.",  "ci_nit": "1234567010","email": "ventas@dcarmen.bo",            "telefono": "+591 22345678", "puntos_acumulados": 520},
    {"id": "d000002a-0000-0000-0000-000000000000", "nombre": "Restaurante La Cabaña Ltda.", "ci_nit": "2345678010","email": "contacto@lacabana.bo",         "telefono": "+591 24567890", "puntos_acumulados": 680},
    {"id": "d000002b-0000-0000-0000-000000000000", "nombre": "Snack El Buen Sabor",         "ci_nit": "3456789011","email": "buensabor@gmail.com",          "telefono": "+591 33456789", "puntos_acumulados": 230},
    {"id": "d000002c-0000-0000-0000-000000000000", "nombre": "Cafetería Andina",            "ci_nit": "4567890012","email": "cafeteria.andina@gmail.com",   "telefono": "+591 44567890", "puntos_acumulados": 410},
    {"id": "d000002d-0000-0000-0000-000000000000", "nombre": "Tienda La Esquina",           "ci_nit": "5678901013","email": None,                            "telefono": "+591 71456780", "puntos_acumulados": 145},
    {"id": "d000002e-0000-0000-0000-000000000000", "nombre": "Cyber Café Boliviano",        "ci_nit": "6789012014","email": "ciber.boliviano@hotmail.com",  "telefono": "+591 72567801", "puntos_acumulados": 85},
    {"id": "d000002f-0000-0000-0000-000000000000", "nombre": "Pollos Doraditos S.A.",       "ci_nit": "7890123015","email": "pollos.doraditos@gmail.com",   "telefono": "+591 33567890", "puntos_acumulados": 750},
    {"id": "d0000030-0000-0000-0000-000000000000", "nombre": "Hostal Mirador del Valle",    "ci_nit": "8901234016","email": "mirador.valle@hotmail.com",    "telefono": "+591 22456789", "puntos_acumulados": 320},

    # Consumidor final clásico (CI genérico)
    {"id": "d0000031-0000-0000-0000-000000000000", "nombre": "Consumidor Final",            "ci_nit": "0",         "email": None,                            "telefono": None,            "puntos_acumulados": 0},
    {"id": "d0000032-0000-0000-0000-000000000000", "nombre": "Sin Nombre",                  "ci_nit": "99",        "email": None,                            "telefono": None,            "puntos_acumulados": 0},
]


async def _ya_seedeado(session: AsyncSession) -> bool:
    """True si al menos uno de los IDs canónicos ya está en la BD."""
    sample_ids = [c["id"] for c in CLIENTES_SEED[:3]]
    result = await session.execute(
        select(Customer.id).where(Customer.id.in_([uuid.UUID(i) for i in sample_ids]))
    )
    return result.first() is not None


async def seed_clientes() -> None:
    async with AsyncSessionLocal() as session:
        if await _ya_seedeado(session):
            logger.info("Clientes ya seedeados — omitiendo.")
            return
        for data in CLIENTES_SEED:
            session.add(Customer(
                id=uuid.UUID(data["id"]),
                nombre=data["nombre"],
                ci_nit=data["ci_nit"],
                email=data["email"],
                telefono=data["telefono"],
                puntos_acumulados=data["puntos_acumulados"],
                activo=True,
            ))
        await session.commit()
        logger.info("Seed completo: %d clientes insertados.", len(CLIENTES_SEED))
