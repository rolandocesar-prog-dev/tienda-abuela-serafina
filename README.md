# Tienda Abuela Serafina — Microservicios

Plataforma distribuida para una cadena nacional de supermercados.
Práctica 3 — Arquitectura de Software, UAB.

## Levantar el sistema

```bash
git checkout integration
cp .env.example .env
docker compose up --build -d
```

Frontend disponible en **http://localhost:3000**

> Para un reinicio limpio (borra todos los datos): `docker compose down -v && docker compose up --build -d`

---

## Credenciales de acceso

### Administrador

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |

### Vendedores por sucursal

| Usuario | Contraseña | Supermercado | Sucursal |
|---------|-----------|-------------|---------|
| `canasta.centro` | `vendedor123` | Supermercados La Canasta | La Canasta Centro — Cochabamba |
| `canasta.norte` | `vendedor123` | Supermercados La Canasta | La Canasta Norte — Cochabamba |
| `canasta.sur` | `vendedor123` | Supermercados La Canasta | La Canasta Sur — Cochabamba |
| `elsol.centro` | `vendedor123` | Supermercado El Sol | El Sol Centro — La Paz |
| `elsol.este` | `vendedor123` | Supermercado El Sol | El Sol Zona Este — La Paz |
| `elsol.oeste` | `vendedor123` | Supermercado El Sol | El Sol Zona Oeste — La Paz |
| `donpedro.principal` | `vendedor123` | Supermercado Don Pedro | Don Pedro Principal — Santa Cruz |
| `donpedro.sur` | `vendedor123` | Supermercado Don Pedro | Don Pedro Zona Sur — Santa Cruz |
| `donpedro.aeropuerto` | `vendedor123` | Supermercado Don Pedro | Don Pedro Aeropuerto — Santa Cruz |

---

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2.0 async · PostgreSQL 16 · Docker Compose · Nginx · RabbitMQ · JWT

## Servicios

| Servicio     | Puerto host | Prefijo gateway  |
|-------------|-------------|-----------------|
| auth         | 8006        | `/auth`          |
| product      | 8001        | `/products`      |
| inventory    | 8002        | `/inventory`     |
| sales        | 8003        | `/sales`         |
| customer     | 8004        | `/customers`     |
| notification | 8005        | `/notifications` |
| company      | 8007        | `/companies`     |
| gateway      | 8000        | —                |
| frontend     | 3000        | —                |

## Documentación

- [docs/architecture.md](docs/architecture.md) — diagrama de arquitectura
- [docs/demo-guide.md](docs/demo-guide.md) — guía de demo para el docente
- [docs/events.md](docs/events.md) — contrato de eventos RabbitMQ
- [docs/quick-start.md](docs/quick-start.md) — tips de desarrollo por servicio
