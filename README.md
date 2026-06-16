# Tienda Abuela Serafina — Microservicios

Plataforma distribuida para una cadena nacional de supermercados.
Práctica 3 — Arquitectura de Software, UAB.

## Estado

**Rama activa:** `integration`. Estructura alineada al PDF (7 servicios).

Para arrancar:

```bash
git checkout integration
cp .env.example .env
docker compose up --build -d
```

**Toda la información para trabajar en equipo está en [docs/HANDOFF.md](docs/HANDOFF.md):**
asignación por persona, cronograma Lun–Jue, plan de demo del PDF, riesgos y plan B.

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2.0 async · asyncpg · Pydantic v2 · PostgreSQL 16 · Docker Compose · Nginx.
Mensajería: RabbitMQ (a integrar por el owner de Notification).
Auth: JWT (a integrar por el owner de Auth).

## Arquitectura

7 microservicios independientes (BD propia cada uno), gateway Nginx que rutea por prefijo, frontend HTML+JS vanilla.

| Servicio     | Puerto host | Prefijo gateway   | Estado |
| ------------ | ----------- | ----------------- | ------ |
| product      | 8001        | `/products`       | CRUD funcional |
| inventory    | 8002        | `/inventory`      | Stock/movimientos funcional; falta Excel/Kardex |
| sales        | 8003        | `/sales`          | GET funcional; POST pendiente |
| customer     | 8004        | `/customers`      | Esqueleto |
| notification | 8005        | `/notifications`  | Esqueleto |
| auth         | 8006        | `/auth`           | Esqueleto |
| company      | 8007        | `/companies`      | Esqueleto |
| gateway      | 8000        | —                 | OK |
| frontend     | 3000        | —                 | 3 tabs visibles |

## Documentación

- [docs/HANDOFF.md](docs/HANDOFF.md) — **trabajo en equipo, asignaciones, cronograma.**
- [docs/architecture.md](docs/architecture.md) — diagrama y decisiones (parcialmente desactualizado por el pivote total).
- [docs/api-contracts.md](docs/api-contracts.md) — contratos HTTP del estado anterior. Cada Swagger por servicio es la verdad actual.
- [docs/quick-start.md](docs/quick-start.md) — tips de iteración por servicio.
