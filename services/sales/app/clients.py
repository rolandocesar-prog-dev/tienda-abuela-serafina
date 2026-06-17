"""Clientes HTTP para servicios dependientes.

Cada cliente encapsula la llamada y traduce errores a HTTPException con códigos
consistentes (404→422, 5xx→502, network→503).

El token JWT del request original se reenvía en cada llamada, ya que los
servicios destino también requieren autenticación.
"""
import uuid

import httpx
from fastapi import HTTPException

from app.config import settings


async def _request(method: str, url: str, token: str, **kwargs) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        try:
            resp = await client.request(method, url, headers=headers, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=422, detail=f"Recurso inexistente en {url}")
            if e.response.status_code == 409:
                raise HTTPException(status_code=409, detail=e.response.json().get("detail", "Conflicto"))
            raise HTTPException(status_code=502, detail=f"Error en dependencia {url}: {e.response.text}")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail=f"Dependencia no disponible: {url}")


class ProductClient:
    @staticmethod
    async def get_product(producto_id: uuid.UUID, token: str) -> dict:
        return await _request("GET", f"{settings.product_url}/products/{producto_id}", token)


class InventoryClient:
    @staticmethod
    async def descontar_stock(payload: dict, token: str) -> dict:
        return await _request("POST", f"{settings.inventory_url}/inventory/output", token, json=payload)
