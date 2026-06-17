import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import init_db
from app.routes import router
from app.seed import seed_admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(settings.service_name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando servicio %s", settings.service_name)
    await init_db()
    await seed_admin()
    logger.info("Servicio %s listo", settings.service_name)
    yield
    logger.info("Cerrando servicio %s", settings.service_name)


app = FastAPI(
    title=f"Tienda Abuela Serafina — {settings.service_name}",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "service": settings.service_name}


app.include_router(router)
