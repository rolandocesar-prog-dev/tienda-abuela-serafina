"""Clientes HTTP para servicios dependientes.

Cada cliente encapsula la llamada y traduce errores a HTTPException con códigos
consistentes (404→422, 5xx→502, network→503). Usar timeouts cortos para
evitar bloquear el flujo de la venta.
"""
import uuid

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
            if e.response.status_code == 409:
                raise HTTPException(status_code=409, detail=e.response.json().get("detail", "Conflicto"))
            raise HTTPException(status_code=502, detail=f"Error en dependencia {url}: {e.response.text}")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail=f"Dependencia no disponible: {url}")


class CatalogClient:
    @staticmethod
    async def get_product(producto_id: uuid.UUID) -> dict:
        return await _request("GET", f"{settings.catalog_url}/products/{producto_id}")


class AlmacenClient:
    @staticmethod
    async def crear_movimiento(payload: dict) -> dict:
        return await _request("POST", f"{settings.almacen_url}/movimientos", json=payload)


class PagosClient:
    @staticmethod
    async def crear_pago(payload: dict) -> dict:
        return await _request("POST", f"{settings.pagos_url}/pagos", json=payload)


class FacturacionClient:
    @staticmethod
    async def emitir_factura(payload: dict) -> dict:
        return await _request("POST", f"{settings.facturacion_url}/facturas", json=payload)
