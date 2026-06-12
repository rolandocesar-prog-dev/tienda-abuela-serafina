# Quick start para contribuidores

## Levantar todo localmente

```bash
cp .env.example .env
docker compose up --build
```

Esto levanta 7 microservicios + 7 Postgres + gateway + frontend. La primera vez tarda ~3 minutos compilando imágenes.

Verifica salud:

```bash
curl http://localhost:8000/catalog/health
curl http://localhost:8000/almacen/health
curl http://localhost:8000/ventas/health
curl http://localhost:8000/compras/health
curl http://localhost:8000/pagos/health
curl http://localhost:8000/facturacion/health
curl http://localhost:8000/rrhh/health
```

## Trabajar en UN solo servicio (recomendado)

Cuando estés implementando tu servicio:

```bash
docker compose up --build <tu-servicio> db-<tu-servicio>
```

Por ejemplo, si te toca `ventas`:

```bash
docker compose up --build ventas db-ventas catalog almacen pagos facturacion
```

(Levanta también sus dependencias porque ventas orquesta.)

Para iterar más rápido, monta tu código en el contenedor agregando al `docker-compose.yml` bajo tu servicio:

```yaml
    volumes:
      - ./services/ventas/app:/app/app
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

No commitees esa modificación — es solo para desarrollo local.

## Reglas de oro

1. **No tocar los `schemas.py` ajenos sin avisar al equipo.** Son contratos.
   Si necesitas cambiar uno, abre un mensaje en el grupo y actualiza también
   [docs/api-contracts.md](api-contracts.md).
2. **No importes de otros servicios.** Si necesitas hablar con otro, es vía HTTP por `clients.py`.
3. **Sigue Conventional Commits**: `feat(ventas):`, `fix(almacen):`, `docs:`, `chore:`.
4. **Cada PR debe levantar limpio con `docker compose up --build`.**
5. Si tu endpoint llama a otro servicio y ese otro falla, usa los códigos:
   - `404` → recurso no existe (el que YO debía encontrar)
   - `409` → conflicto (stock insuficiente)
   - `422` → input inválido / recurso referenciado no existe en otro servicio
   - `502` → dependencia respondió mal
   - `503` → dependencia no responde

## Probar endpoints

Cada servicio expone Swagger automático:

- catalog → http://localhost:8001/docs
- almacen → http://localhost:8002/docs
- ventas → http://localhost:8003/docs
- compras → http://localhost:8004/docs
- pagos → http://localhost:8005/docs
- facturacion → http://localhost:8006/docs
- rrhh → http://localhost:8007/docs

## Reset de base de datos

Si tu BD local quedó en estado raro:

```bash
docker compose down -v
docker compose up --build
```

`-v` borra los volúmenes — empezás de cero.
