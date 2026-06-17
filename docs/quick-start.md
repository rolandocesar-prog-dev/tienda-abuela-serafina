# Quick start para desarrollo

> Para levantar y usar el sistema completo, ver [README](../README.md) y [demo-guide.md](demo-guide.md).
> Este archivo cubre tips específicos para iterar sobre el código.

## Trabajar en un solo servicio

En lugar de levantar todo, levantás solo el servicio que estás editando más sus dependencias:

```bash
# Ejemplo: trabajar en inventory
docker compose up --build inventory db-inventory rabbitmq
```

Servicios y sus dependencias directas:

| Servicio | Dependencias al levantar |
|---|---|
| auth | db-auth |
| product | db-product, rabbitmq |
| inventory | db-inventory, rabbitmq |
| sales | db-sales, rabbitmq |
| customer | db-customer, rabbitmq |
| notification | db-notification, rabbitmq |
| company | db-company |

## Hot reload durante desarrollo

Agregar esto al servicio en `docker-compose.yml` para no reconstruir la imagen en cada cambio:

```yaml
    volumes:
      - ./services/inventory/app:/app/app
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

No commitear esa modificación — es solo para desarrollo local.

## Probar endpoints directamente

Cada servicio expone Swagger en su puerto host:

- auth → http://localhost:8006/docs
- product → http://localhost:8001/docs
- inventory → http://localhost:8002/docs
- sales → http://localhost:8003/docs
- customer → http://localhost:8004/docs
- notification → http://localhost:8005/docs
- company → http://localhost:8007/docs

También por el gateway (requiere JWT en el header `Authorization: Bearer <token>`):

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Usar el token
curl http://localhost:8000/products -H "Authorization: Bearer $TOKEN"
```

## Convenciones de commit

```
feat(inventory): agregar endpoint de transferencia
fix(sales): corregir cálculo de total con descuento
docs: actualizar arquitectura
chore: bump dependencies
```

## Códigos de error entre servicios

| Código | Cuándo usarlo |
|---|---|
| `404` | El recurso que YO debía encontrar no existe |
| `409` | Conflicto de negocio (stock insuficiente, duplicado) |
| `422` | Input inválido o referencia a recurso inexistente en otro servicio |
| `502` | Dependencia respondió con error |
| `503` | Dependencia no responde (timeout, connection refused) |

## Reset de BD

```bash
docker compose down -v && docker compose up --build -d
```

El seed es idempotente: re-crea los 3 supermercados, 9 sucursales, 25 productos, 10 usuarios (admin + 9 vendedores) y 50 clientes automáticamente al levantar.

## Cambios al schema → rebuild

`init_db` usa `Base.metadata.create_all` (no Alembic). **NO** añade columnas a tablas existentes. Si modificás un modelo (ej. agregás un campo a `Venta`):

```bash
docker compose down -v && docker compose up --build -d
```

Sin el `-v` la columna nueva nunca aparece en la BD existente.

## Trabajar en el frontend sin rebuild

Los archivos del frontend están montados como volumen, no como build. Para ver cambios:
- HTML/CSS/JS estático: **Ctrl+Shift+R** en el browser
- Si el cambio no aparece: `docker compose restart frontend` (limpia cache de nginx)

## SKU autogenerado en productos

`POST /products` permite omitir `codigo`. El backend genera el siguiente correlativo usando un mapa de prefijos por categoría:

| Categoría | Prefijo |
|---|---|
| Lácteos | LAC |
| Carnes y Embutidos | CAR |
| Abarrotes | ABA |
| Bebidas | BEB |
| Limpieza | LIM |
| Higiene | HIG |
| Panadería | PAN |

Para categorías nuevas el fallback son las primeras 3 letras normalizadas (sin acentos, mayúsculas).
