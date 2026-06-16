"""
Modelos del Notification Service.

TODO(owner-notification): definir tabla(s) según el PDF:
- Notification (id, fecha, cliente, tipo, contenido, evento_origen, payload_json)
  donde tipo ∈ {email, sms, whatsapp, push}.
"""
from app.database import Base  # noqa: F401
