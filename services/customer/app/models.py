"""
Modelos del Customer Service.

TODO(owner-customer): definir las tablas según el PDF de la práctica:
- Customer (id, nombre, ci/nit, email, teléfono, fecha_registro, puntos_acumulados, activo)
- PuntosHistorial (id, customer_id, fecha, motivo, puntos, saldo_posterior)
- Descuento (id, customer_id, codigo, porcentaje, valido_hasta, usado)

El nombre Base se importa de app.database — no crear otra.
"""
from app.database import Base  # noqa: F401
