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

## Quick start (estado esqueleto)

> ⚠️ **El proyecto está en estado ESQUELETO.** Todo levanta, pero la lógica
> de los endpoints todavía no está implementada — devuelven `501 No implementado`.
> Ese es el punto de partida desde donde cada uno implementa SU servicio.

### 1. Pre-requisitos

- Docker Desktop instalado y corriendo (Windows/Mac) o Docker Engine + Compose v2 (Linux).
- Git.
- Puertos libres en localhost: `3000`, `8000`, `8001`–`8007`, `54321`–`54327`.

### 2. Clonar y levantar

```bash
git clone <url-del-repo>
cd tienda-abuela
cp .env.example .env
docker compose up --build
```

La primera vez tarda ~3 minutos (descarga imágenes + compila los 7 servicios).
Cuando todo está listo verás algo como `Application startup complete` por cada servicio.

Para correr en segundo plano: `docker compose up --build -d`
Para ver el estado: `docker compose ps` (todos deberían estar `running (healthy)`)
Para apagar: `docker compose down` (agregar `-v` para borrar también las BDs).

### 3. Qué deberías ver funcionando en este estado esqueleto

✅ **Sí funciona ahora mismo:**

| Comprobación                                                       | Esperado                                            |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `curl http://localhost:8000/health`                                | `{"status":"ok","service":"gateway"}`               |
| `curl http://localhost:8000/catalog/health`                        | `{"status":"ok","service":"catalog"}`               |
| `curl http://localhost:8000/almacen/health`                        | `{"status":"ok","service":"almacen"}`               |
| `curl http://localhost:8000/ventas/health`                         | `{"status":"ok","service":"ventas"}`                |
| `curl http://localhost:8000/compras/health`                        | `{"status":"ok","service":"compras"}`               |
| `curl http://localhost:8000/pagos/health`                          | `{"status":"ok","service":"pagos"}`                 |
| `curl http://localhost:8000/facturacion/health`                    | `{"status":"ok","service":"facturacion"}`           |
| `curl http://localhost:8000/rrhh/health`                           | `{"status":"ok","service":"rrhh"}`                  |
| Abrir <http://localhost:3000>                                      | Frontend con header, 5 tabs y dropdown de agencias  |
| Abrir <http://localhost:8001/docs> (idem 8002..8007)               | Swagger con todos los endpoints listados            |
| En cualquier servicio con agencias (almacen, ventas, compras, facturacion, rrhh), ver los logs: | "Servicio X listo" tras crear 6 agencias en seed   |

❌ **NO funciona aún** (lo va a implementar cada owner):

- `POST /catalog/products`, `GET /catalog/products`, etc. → devuelven `501 No implementado`.
- `POST /ventas/ventas`, `POST /compras/ordenes-compra`, etc. → `501`.
- Los tabs del frontend muestran un mensaje `TODO(owner-frontend)`.
- Stripe no funciona (las llaves en `.env.example` son placeholders).

Esto es **esperado** — significa que el esqueleto está bien.

### 4. Próximo paso

Cada persona toma su servicio según [docs/asignacion-equipo.md](docs/asignacion-equipo.md)
y empieza a implementar la lógica en su `routes.py`. Los contratos en `schemas.py`
y los endpoints en `routes.py` ya están — solo hay que rellenar el cuerpo.

Ver [docs/quick-start.md](docs/quick-start.md) para tips de cómo iterar rápido
en un solo servicio sin levantar todo.

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
