# Tienda Abuela Serafina — Microservicios

Sistema de gestión retail multi-sucursal / multi-agencia.
Práctica 3 — Arquitectura de Software, UAB.

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2.0 async · asyncpg · Pydantic v2 · PostgreSQL 16 · Docker Compose · Nginx · Stripe (test).

## Arquitectura

Siete microservicios independientes (BD propia cada uno), un gateway Nginx que rutea por prefijo, y un frontend HTML+JS vanilla.

| Servicio    | Puerto host | Prefijo en gateway |
| ----------- | ----------- | ------------------ |
| catalog     | 8001        | /catalog/          |
| almacen     | 8002        | /almacen/          |
| ventas      | 8003        | /ventas/           |
| compras     | 8004        | /compras/          |
| pagos       | 8005        | /pagos/            |
| facturacion | 8006        | /facturacion/      |
| rrhh        | 8007        | /rrhh/             |
| gateway     | 8000        | —                  |
| frontend    | 3000        | —                  |

## Quick start

```bash
cp .env.example .env
# Editar .env si vas a tocar Stripe (sk_test_..., whsec_...)
docker compose up --build
```

Verificar:
- `http://localhost:8000/catalog/health` → 200
- `http://localhost:3000` → frontend
- `http://localhost:8001/docs` → Swagger del servicio catalog (idem 8002..8007)

## Estado actual de la base

Lo que **YA está hecho** (esqueleto compartido, no tocar sin coordinar):

- Estructura de carpetas completa para los 7 servicios.
- `docker-compose.yml` con 7 servicios + 7 Postgres + gateway + frontend.
- `gateway/nginx.conf` con ruteo por prefijo.
- Por cada servicio: `Dockerfile`, `requirements.txt`, `app/main.py`, `app/config.py`,
  `app/database.py`, `app/seed.py`, `app/models.py` (con la tabla de la entidad),
  `app/schemas.py` (con los **contratos del API ya definidos**), y `app/routes.py`
  (con las firmas de los endpoints — devuelven 501 hasta que se implementen).
- `app/clients.py` para Ventas y Compras (orquestadores) con los helpers HTTP listos.
- Frontend con tabs y dropdown de agencias funcionando.

Lo que **falta** (asignado por servicio):

- Implementar la lógica interna de cada endpoint (los `# TODO(owner-XXX)` en routes.py).
- Integrar Stripe en pagos (SDK ya en requirements.txt).
- Implementar las llamadas reales en `frontend/app.js`.
- Integración E2E (`POST /ventas` y `/ordenes-compra/{id}/recepcion`).

Ver [docs/asignacion-equipo.md](docs/asignacion-equipo.md) para quién toma qué.

## Documentación

- [docs/quick-start.md](docs/quick-start.md) — cómo trabajar en un servicio.
- [docs/api-contracts.md](docs/api-contracts.md) — contratos HTTP inter-servicio.
- [docs/architecture.md](docs/architecture.md) — diagrama y decisiones.
- [docs/asignacion-equipo.md](docs/asignacion-equipo.md) — quién hace qué.

## Restricciones del proyecto (no negociables)

- Sin autenticación, sin login, sin roles.
- Una sola compañía. Multi-sucursal y multi-agencia sí.
- Cada microservicio debe poder levantarse y funcionar independientemente.
- Comunicación inter-servicio **solo** por HTTP REST.
- No compartir esquemas de BD entre servicios.
