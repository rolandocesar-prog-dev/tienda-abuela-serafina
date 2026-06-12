"""Clientes HTTP a Almacen y Pagos (usados en /ordenes-compra/{id}/recepcion)."""
import httpx
from fastapi import HTTPException

from app.config import settings


async def _request(method: str, url: str, **kwargs) -> dict:
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        try:
            resp = await client.request(method, url, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=422, detail=f"Recurso inexistente en {url}")
            raise HTTPException(status_code=502, detail=f"Error en dependencia {url}: {e.response.text}")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail=f"Dependencia no disponible: {url}")


class AlmacenClient:
    @staticmethod
    async def crear_movimiento(payload: dict) -> dict:
        return await _request("POST", f"{settings.almacen_url}/movimientos", json=payload)


class PagosClient:
    @staticmethod
    async def crear_cuenta_por_pagar(payload: dict) -> dict:
        return await _request("POST", f"{settings.pagos_url}/cuentas-por-pagar", json=payload)
