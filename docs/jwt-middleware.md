# JWT Middleware — guía para todos los servicios

El Auth Service emite tokens JWT.  Los otros 6 servicios deben validarlos
usando el mismo secreto (`JWT_SECRET` de `.env`).

---

## 1. Agregar dependencias

En `services/<tu-servicio>/requirements.txt`, añade:

```
python-jose[cryptography]==3.3.0
```

> **Nota:** El Auth Service usa `bcrypt==4.2.0` directamente (sin passlib) porque passlib 1.7.4 no es compatible con bcrypt 4.x en Python 3.12.

---

## 2. Copiar `security.py`

Crea `services/<tu-servicio>/app/security.py` con el siguiente contenido
(cambia solo el import de `settings` si tu config tiene otro nombre):

```python
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.config import settings   # ajusta si tu módulo se llama distinto

_bearer = HTTPBearer(auto_error=False)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación (Bearer token)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(credentials.credentials)


def require_rol(*roles: str):
    """Exige uno o más roles. Uso: Depends(require_rol('Administrador'))"""
    async def _check(payload: dict = Depends(verify_jwt)) -> dict:
        if payload.get("rol") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol: {', '.join(roles)}",
            )
        return payload
    return _check
```

---

## 3. Agregar `jwt_secret` a tu `config.py`

```python
class Settings(BaseSettings):
    # ...campos existentes...
    jwt_secret: str = "CHANGE-ME-IN-PROD"
```

El valor real viene de la variable de entorno `JWT_SECRET` (definida en `.env`).

---

## 4. Proteger endpoints

**Opción A — proteger todo el router:**

```python
from app.security import verify_jwt
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/sales", dependencies=[Depends(verify_jwt)])
```

**Opción B — proteger un endpoint individual:**

```python
from app.security import verify_jwt

@router.post("/sales")
async def crear_venta(payload: dict = Depends(verify_jwt)):
    user_id = payload["sub"]   # UUID del usuario autenticado
    rol     = payload["rol"]   # "Administrador" | "Cajero" | "Supervisor" | "Gerente"
    ...
```

**Opción C — proteger por rol:**

```python
from app.security import require_rol

@router.delete("/{id}", dependencies=[Depends(require_rol("Administrador", "Gerente"))])
async def eliminar(...):
    ...
```

---

## 5. Payload del JWT

| Campo | Tipo   | Descripción                       |
|-------|--------|-----------------------------------|
| `sub` | string | UUID del usuario                  |
| `rol` | string | `Administrador` / `Cajero` / `Supervisor` / `Gerente` |
| `iat` | int    | timestamp emisión                 |
| `exp` | int    | timestamp expiración (default 60 min) |
| `jti` | string | UUID único del token              |

---

## 6. Probar con curl

```bash
# 1. Registrar un usuario
curl -s -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","email":"admin@tienda.com","password":"secret123","rol":"Administrador"}' | jq .

# 2. Login → obtener token
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"secret123"}' | jq -r '.access_token')

# 3. Usar el token en otro servicio
curl -s http://localhost/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Llamar a un endpoint protegido de otro servicio (cuando lo tengan activo)
curl -s -X POST http://localhost/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq .
```

---

## 7. Tabla de quién implementa qué

| Servicio     | Acción necesaria                                           | Owner |
|--------------|------------------------------------------------------------|-------|
| **auth**     | ✅ Ya implementado                                          | Auth  |
| product      | Copiar `security.py`, agregar `jwt_secret` a config, proteger rutas de escritura | Product |
| inventory    | Ídem                                                       | Rolando |
| sales        | Ídem                                                       | Sales |
| customer     | Ídem                                                       | Customer |
| notification | Solo lectura — proteger GET /notifications                 | Notification |
| company      | Ídem                                                       | Company |
