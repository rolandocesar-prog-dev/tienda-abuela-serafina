"""Clientes HTTP para servicios dependientes.

Cada cliente encapsula la llamada y traduce errores a HTTPException con códigos
consistentes (404→422, 5xx→502, network→503). Usar timeouts cortos para
evitar bloquear el flujo de la venta.

TODO(owner-sales): la orquestación full debe llamar:
- ProductClient.get_product → precios y nombres
- InventoryClient.descontar_stock → vía POST /inventory/output
- CustomerClient.asignar_puntos → POST /customers/{id}/points (opcional, o vía evento)

Pagos y Facturación fueron archivados en el pivote total. Si vuelven, agregar
clientes acá.
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


class ProductClient:
    @staticmethod
    async def get_product(producto_id: uuid.UUID) -> dict:
        return await _request("GET", f"{settings.product_url}/products/{producto_id}")


class InventoryClient:
    @staticmethod
    async def crear_movimiento(payload: dict) -> dict:
        # TODO(owner-sales): actualizar a /inventory/output cuando el owner de
        # inventory implemente el endpoint del PDF. Por ahora sigue /movimientos.
        return await _request("POST", f"{settings.inventory_url}/inventory/movimientos", json=payload)


class CustomerClient:
    @staticmethod
    async def asignar_puntos(customer_id: uuid.UUID, payload: dict) -> dict:
        return await _request(
            "POST",
            f"{settings.customer_url}/customers/{customer_id}/points",
            json=payload,
        )
