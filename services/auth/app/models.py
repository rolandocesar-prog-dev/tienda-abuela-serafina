"""
TODO(owner-auth): definir modelos del Auth Service.

Roles exigidos por el PDF: Administrador, Cajero, Supervisor, Gerente.

- Usuario (id, username, email, password_hash, rol, activo, fecha_creacion)
- (opcional) Sesion (id, usuario_id, token_jti, fecha_emision, fecha_expira)
"""
from app.database import Base  # noqa: F401
