# Guía de demo

Script de demostración para la presentación al docente.

---

## 1. Pre-requisitos

- Docker Desktop (Windows/Mac) o Docker Engine + Compose v2 (Linux)
- Git
- Puertos libres: `3000`, `8000`, `8001`–`8007`

---

## 2. Levantar el sistema

```bash
git checkout integration
cp .env.example .env
docker compose up --build -d
```

Primera vez: ~3 minutos compilando imágenes. Verificar que todos los servicios estén `(healthy)`:

```bash
docker compose ps
```

Frontend disponible en **http://localhost:3000**

---

## 3. Verificación rápida por terminal

```bash
for s in auth products inventory sales customers notifications companies; do
  curl -s http://localhost:8000/$s/health
  echo ""
done
```

Esperás 7 líneas `{"status":"ok","service":"..."}`.

Swagger de cada servicio:
- auth → http://localhost:8006/docs
- product → http://localhost:8001/docs
- inventory → http://localhost:8002/docs
- sales → http://localhost:8003/docs
- customer → http://localhost:8004/docs
- notification → http://localhost:8005/docs
- company → http://localhost:8007/docs

---

## 4. Demo desde el frontend

### 4.1 Login como Administrador

1. Abrir **http://localhost:3000** — aparece la pantalla de login completa.
2. Usuario: `admin` / Contraseña: `admin123` → **Iniciar Sesión**.
3. El menú muestra: **Productos · Inventario · Empresa · Reportes** (sin Ventas — el admin no opera la caja).

### 4.2 Tab Productos

- Catálogo pre-cargado: 25 productos en 5 categorías (Lácteos, Bebidas, Limpieza, Panadería, Carnes).
- Demostrar: crear un producto nuevo, editar precio, importar desde Excel.

### 4.3 Tab Inventario

1. Selector de sucursal → elegir **La Canasta Centro**.
2. Ver el stock inicial de los 25 productos.
3. Click **Transferir entre Sucursales**:
   - Supermercado: `Supermercados La Canasta`
   - Origen: `La Canasta Centro`, Destino: `La Canasta Norte`
   - Producto: `Leche Entera PIL 1L`, Cantidad: `10`
   - **Confirmar transferencia**
4. Recargar inventario: el stock bajó en Centro y subió en Norte.

> Internamente: `POST /inventory/transfer` ejecuta salida + entrada atómicamente y publica `TransferCompleted` al bus.

### 4.4 Tab Empresa

- Lista de los 3 supermercados con sus 9 sucursales.
- Demostrar: crear una nueva empresa o sucursal.

### 4.5 Tab Reportes

- **General**: totales globales, top 10 productos más vendidos, últimas ventas.
- **Por Supermercado**: ventas agrupadas por empresa.
- **Por Sucursal**: filtrar por supermercado, ver cada sucursal.

*(Al arranque las ventas son 0 — después de la demo del vendedor, volver aquí para mostrar los datos reales.)*

---

### 4.6 Cerrar sesión y login como Vendedor

1. Click **Cerrar sesión** → regresa a la pantalla de login.
2. Usuario: `canasta.centro` / Contraseña: `vendedor123` → **Iniciar Sesión**.
3. El menú muestra **solo Ventas** — la sucursal ya viene pre-seleccionada.

### 4.7 Tab Ventas — realizar una venta

1. El panel **Carrito de Compras** está listo con la sucursal `La Canasta Centro`.
2. Buscar producto → `Leche Entera PIL 1L` → agregar al carrito (cantidad 2).
3. Agregar otro: `Pan Marraqueta` → cantidad 3.
4. Sección **Cliente**: nombre `Ana López`, documento `12345678`.
5. Click **Procesar Venta** — aparece confirmación con el total.
6. El panel de estadísticas actualiza: **Ventas Hoy**, **Total Ventas**, **Clientes Hoy**, **Ticket Promedio** — todos filtrados por esta sucursal.

> Internamente: `POST /sales` → descuenta stock vía inventory → publica `SaleCompleted` → notification registra la notificación → customer acumula puntos.

---

### 4.8 Volver como admin y ver Reportes

1. Cerrar sesión → login `admin / admin123`.
2. Tab **Reportes** → ahora la venta de `canasta.centro` aparece en los tres niveles (General, La Canasta, La Canasta Centro).

---

## 5. Demostrar independencia entre servicios

```bash
# Bajar solo notification
docker compose stop notification

# Los demás siguen respondiendo:
curl http://localhost:8000/products/health
curl http://localhost:8000/sales/health

# Pero notification devuelve 502:
curl -i http://localhost:8000/notifications/health

# Volver a levantarlo:
docker compose start notification
```

---

## 6. Reset completo

```bash
docker compose down -v && docker compose up --build -d
```

`-v` borra los volúmenes de Postgres. El seed re-crea los 3 supermercados, 9 sucursales, 25 productos, 225 stocks y los 10 usuarios (admin + 9 vendedores) automáticamente.

---

## 7. Troubleshooting

| Síntoma | Solución |
|---|---|
| Un servicio rebota en loop | `docker compose logs <servicio>` para ver el error real |
| El frontend no carga datos | Verificar CORS en consola del navegador (F12); el gateway Nginx envía los headers correctos |
| `failed to set up container networking` | `docker compose down && docker compose up -d` recrea la red |
| Stock insuficiente al vender | El stock seed tiene variación intencional — elegir otro producto o hacer un reset |

---

## 8. Checklist de criterios de evaluación

| Criterio | Cómo demostrarlo |
|---|---|
| `docker compose up --build` levanta todo | Sección 2 |
| Los `/health` responden 200 vía gateway | Sección 3 |
| JWT: login, roles diferenciados | Secciones 4.1 y 4.6 |
| Admin ve Productos / Inventario / Empresa / Reportes | Secciones 4.2–4.5 |
| Vendedor ve solo Ventas filtradas por sucursal | Sección 4.7 |
| Venta E2E (descuenta stock, registra cliente) | Sección 4.7 |
| Transferencia de stock entre sucursales | Sección 4.3 |
| Eventos RabbitMQ (SaleCompleted → notification) | Validar en http://localhost:15672 (guest/guest) |
| Datos seed pre-cargados al levantar | Visible en Productos e Inventario sin cargar nada manualmente |
| Independencia de servicios | Sección 5 |
| Reportes consolidados por nivel | Sección 4.8 |
