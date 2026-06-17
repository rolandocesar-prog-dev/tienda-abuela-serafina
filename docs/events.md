# Contrato de eventos del bus

Broker: **RabbitMQ 3.x** (imagen oficial `rabbitmq:3-management`).
URL desde la red Docker: `amqp://guest:guest@rabbitmq:5672/`
Management UI: http://localhost:15672 (guest / guest)

## Topología

Un solo exchange tipo `topic` llamado **`events`**, durable.
Cada servicio publica con `routing_key` = nombre del evento (ej. `SaleCompleted`).
Cada consumidor declara su propia cola durable y hace `bind` con el routing key que le interesa.

```
                       ┌────────────┐
publishers ──publish──▶│  events    │──bind──▶ queue q.notification.all ──▶ Notification
                       │ exchange   │──bind──▶ queue q.customer.sale    ──▶ Customer
                       │  (topic)   │
                       └────────────┘
```

Naming de colas: `q.<servicio>.<patrón>`. Por ejemplo:
- Notification consume todo (`#`) → cola `q.notification.all`
- Customer escucha `SaleCompleted` → cola `q.customer.sale-completed`

## Estructura del payload

JSON. Mismo wrapper para todos los eventos:

```json
{
  "event_type":  "SaleCompleted",
  "event_id":    "uuid-v4 generado por el publisher",
  "timestamp":   "2026-06-18T10:30:00Z",
  "source":      "sales",
  "data": {
    "...campos específicos del evento..."
  }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `event_type` | string | sí | Nombre canónico (coincide con el routing_key) |
| `event_id` | UUID | sí | Para idempotencia del consumidor |
| `timestamp` | ISO-8601 UTC | sí | Cuándo lo publicó el origen |
| `source` | string | sí | Nombre del servicio (`inventory`, `sales`, etc.) |
| `data` | objeto | sí | Específico de cada evento (ver más abajo) |

## Eventos por servicio

### Inventory publica

| Evento | Cuándo | `data` |
|---|---|---|
| `InventoryLoaded` | Tras `POST /inventory/loadExcel` | `archivo` (str), `filas_procesadas` (int) |
| `InventoryUpdated` | Tras cada movimiento (entrada / salida) | `tipo` (entrada\|salida\|ajuste), `agencia_id`, `producto_id`, `cantidad`, `saldo_posterior` |
| `TransferCompleted` | Tras `POST /inventory/transfer` exitoso | `sucursal_origen_id`, `sucursal_destino_id`, `producto_id`, `cantidad` |
| `StockLow` | Cuando `saldo_posterior < 10` (umbral configurable) | `agencia_id`, `producto_id`, `saldo_actual`, `umbral` |

### Product publica

| Evento | Cuándo | `data` |
|---|---|---|
| `ProductCreated` | Tras `POST /products` | `id`, `codigo`, `nombre`, `categoria`, `precio_base` |
| `ProductUpdated` | Tras `PUT /products/{id}` | `id`, `cambios` (dict campo→nuevo_valor) |
| `ProductDeleted` | Tras `DELETE /products/{id}` | `id`, `codigo` |

### Sales publica

| Evento | Cuándo | `data` |
|---|---|---|
| `SaleCreated` | Al iniciar el flujo (estado pendiente) | `sale_id`, `cliente_id`, `total` |
| `SaleCancelled` | Si compensa por fallo | `sale_id`, `motivo` |
| `SaleCompleted` | Al cerrar exitosamente | `sale_id`, `cliente_id`, `sucursal_id`, `items` (lista), `total` |

### Customer publica

| Evento | Cuándo | `data` |
|---|---|---|
| `CustomerCreated` | Tras `POST /customers` | `id`, `nombre`, `ci_nit` |
| `CustomerUpdated` | Tras `PUT /customers/{id}` | `id`, `cambios` |
| `PointsAssigned` | Tras `POST /customers/{id}/points` | `customer_id`, `puntos`, `motivo`, `saldo_posterior` |

### Notification consume

Suscripto a todos los eventos (`#`). Registra fila en tabla `notifications` con `(fecha, tipo, contenido)` para:
- `SaleCompleted`
- `TransferCompleted`
- `PointsAssigned`
- `StockLow`

### Customer consume

- `SaleCompleted` → asigna puntos automáticamente al cliente de la venta.

## Idempotencia

Los consumidores usan `event_id` para evitar procesar el mismo evento dos veces.
Tabla `processed_events(event_id PRIMARY KEY, processed_at)` en cada consumidor.

## Manejo de errores

- Si el consumidor lanza excepción: `nack` con `requeue=False` (evita loop infinito).
- Si el publisher falla al publicar: no revierte su transacción de BD. La transacción local ya fue confirmada.

## Cómo agregar un evento nuevo

1. Agregar una fila a la tabla del servicio en este archivo.
2. En el publisher: agregar la llamada en `services/<servicio>/app/events.py`.
3. En cada consumidor que lo necesite: declarar cola + bind en `services/<servicio>/app/consumer.py`.

## Implementación de referencia

- Publisher: `services/inventory/app/events.py`
- Consumer: `services/notification/app/consumer.py`
