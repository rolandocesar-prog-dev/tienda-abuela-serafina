# Contrato de eventos del bus

Broker: **RabbitMQ 3.x** (imagen oficial `rabbitmq:3-management`).
URL: `amqp://guest:guest@rabbitmq:5672/` desde la red de docker-compose; Management UI en <http://localhost:15672>.

## Topología

Un solo exchange tipo `topic` llamado **`events`**, durable.
Cada servicio publica con `routing_key` = nombre del evento (ej. `SaleCompleted`, `InventoryUpdated`).
Cada consumidor declara su propia cola durable e hace `bind` con el routing key que le interesa.

```
                       ┌────────────┐
publishers ──publish──▶│  events    │──bind──▶ queue notif.* ──▶ Notification
                       │ exchange   │──bind──▶ queue cust.*  ──▶ Customer
                       │  (topic)   │──bind──▶ queue inv.*   ──▶ Inventory (futuro)
                       └────────────┘
```

Naming de colas: `q.<servicio>.<routing_pattern>`. Por ejemplo:
- Notification consume `*` (todo lo que pase) → cola `q.notification.all` bind `#`.
- Customer escucha `SaleCompleted` (para sumar puntos) → cola `q.customer.sale-completed` bind `SaleCompleted`.

## Estructura del payload

JSON. Mismo wrapper para todos los eventos:

```json
{
  "event_type":  "InventoryUpdated",
  "event_id":    "uuid-v4 generado por el publisher",
  "timestamp":   "2026-06-18T10:30:00Z",
  "source":      "inventory",
  "data": {
    "...campos específicos del evento..."
  }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `event_type` | string | sí | Nombre canónico (ver tabla abajo). Coincide con el routing_key. |
| `event_id` | UUID | sí | Para idempotencia del consumidor. |
| `timestamp` | ISO-8601 UTC | sí | Cuándo lo publicó el origen. |
| `source` | string | sí | Nombre del servicio que lo emite (`inventory`, `sales`, etc). |
| `data` | objeto | sí | Específico de cada evento (ver más abajo). |

## Eventos del bus

### Inventory Service publica
| Evento | Cuándo | `data` |
|---|---|---|
| `InventoryLoaded` | Tras un `POST /inventory/loadExcel` | `archivo` (str), `filas_procesadas` (int) |
| `InventoryUpdated` | Tras cada movimiento (input/output/transfer interno) | `tipo` (entrada\|salida\|ajuste), `agencia_id`, `producto_id`, `cantidad`, `saldo_posterior` |
| `TransferCompleted` | Tras un `POST /inventory/transfer` exitoso | `sucursal_origen_id`, `sucursal_destino_id`, `producto_id`, `cantidad` |
| `StockLow` | Cuando `saldo_posterior < UMBRAL_STOCK_BAJO` (default 10) | `agencia_id`, `producto_id`, `saldo_actual`, `umbral` |

### Product Service publica
| Evento | Cuándo | `data` |
|---|---|---|
| `ProductCreated` | Tras `POST /products` | `id`, `codigo`, `nombre`, `categoria`, `precio_base` |
| `ProductUpdated` | Tras `PUT /products/{id}` | `id`, `cambios` (dict de campo→nuevo_valor) |
| `ProductDeleted` | Tras `DELETE /products/{id}` | `id`, `codigo` |

### Sales Service publica
| Evento | Cuándo | `data` |
|---|---|---|
| `SaleCreated` | Al iniciar el flujo de venta (estado pendiente) | `sale_id`, `cliente_id`, `total` |
| `SaleCancelled` | Si compensa por fallo en alguna llamada | `sale_id`, `motivo` |
| `SaleCompleted` | Al cerrar exitosamente | `sale_id`, `cliente_id`, `sucursal_id`, `items` (lista), `total` |

### Customer Service publica
| Evento | Cuándo | `data` |
|---|---|---|
| `CustomerCreated` | Tras `POST /customers` | `id`, `nombre`, `ci_nit` |
| `CustomerUpdated` | Tras `PUT /customers/{id}` | `id`, `cambios` |
| `PointsAssigned` | Tras `POST /customers/{id}/points` | `customer_id`, `puntos`, `motivo`, `saldo_posterior` |

### Notification Service consume
Suscripto a todos (`#`) y registra en su BD:
- `SaleCompleted`
- `TransferCompleted`
- `PointsAssigned`
- `PromotionCreated` (lo lanzará Product u otro en una fase posterior — opcional)

Registra fila en tabla `notifications` con: `(fecha, cliente, tipo, contenido)` según pide el PDF.

### Customer Service consume (opcional / a discreción)
- `SaleCompleted` → asignar puntos automáticamente al cliente de la venta.

## Idempotencia

Los consumidores **deben** usar `event_id` para evitar procesar dos veces.
Una tabla `processed_events(event_id PRIMARY KEY, processed_at)` en cada consumidor es suficiente.

## Errores

- Si el consumidor lanza una excepción, el mensaje vuelve a la cola (`nack` con `requeue=False` para evitar loops infinitos — se manda a la DLX si se configura, o se descarta).
- Si el publisher falla al publicar, **no** debe revertir su transacción de BD. Se confía en que el evento eventualmente saldrá vía reintento. Para los publishers críticos (Sales), considerar **outbox pattern** si hay tiempo.

## Cómo agregar un evento nuevo

1. Editar este documento agregando una fila a la tabla del servicio.
2. En el publisher: agregar la llamada en `app/events.py`.
3. En los consumidores que lo necesiten: declarar la cola + bind al exchange `events` con el routing key.

## Implementación de referencia

Ver:
- Publisher: `services/inventory/app/events.py`
- Consumer: `services/notification/app/consumer.py`
