"""
TODO(owner-company): definir modelos del Company Service.

- Company (id, nombre, nit, fecha_creacion, activo)
- Branch / Sucursal (id, company_id, nombre, ciudad, direccion, activo)
- City (opcional — puede ser solo un string en Branch)

El PDF ejemplifica:
  Empresa: SuperMarket Bolivia
  Sucursales: Cochabamba Norte, Cochabamba Sur, La Paz, Santa Cruz, Central, Zona Norte
"""
from app.database import Base  # noqa: F401
