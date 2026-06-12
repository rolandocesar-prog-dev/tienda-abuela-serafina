// Frontend de Tienda Abuela Serafina
// Todas las llamadas pasan por el gateway en :8000.

const GATEWAY = "http://localhost:8000";

// Datos compartidos (mismos UUIDs del seed en cada servicio).
const AGENCIAS = [
    { id: "660e8400-e29b-41d4-a716-446655440001", nombre: "Centro La Paz",   codigo: "A001" },
    { id: "660e8400-e29b-41d4-a716-446655440002", nombre: "Sopocachi",       codigo: "A002" },
    { id: "660e8400-e29b-41d4-a716-446655440003", nombre: "Equipetrol",      codigo: "A003" },
    { id: "660e8400-e29b-41d4-a716-446655440004", nombre: "Norte",           codigo: "A004" },
    { id: "660e8400-e29b-41d4-a716-446655440005", nombre: "Centro Cocha",    codigo: "A005" },
    { id: "660e8400-e29b-41d4-a716-446655440006", nombre: "Sur",             codigo: "A006" },
];

// ---------- Estado de la app ----------
const state = {
    agenciaActiva: AGENCIAS[0].id,
    productos: [],
    ventaCarrito: [],          // [{producto_id, nombre, cantidad, precio_unitario}]
    compraCarrito: [],
    proveedores: [],
};

// ---------- Helpers ----------
async function api(path, options = {}) {
    const resp = await fetch(`${GATEWAY}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!resp.ok) {
        const detail = data && data.detail ? data.detail : text || resp.statusText;
        throw new Error(`${resp.status}: ${detail}`);
    }
    return data;
}

function toast(msg, kind = "ok") {
    const div = document.createElement("div");
    div.className = `msg ${kind}`;
    div.textContent = msg;
    document.getElementById("toast").appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function nombreAgencia(id) {
    const a = AGENCIAS.find(a => a.id === id);
    return a ? `${a.codigo} — ${a.nombre}` : id.slice(0, 8) + "...";
}

function pill(estado) {
    return `<span class="estado-pill estado-${estado}">${estado}</span>`;
}

// ---------- Inicialización ----------
function poblarSelectAgencia(sel, incluirVacio = false) {
    if (incluirVacio) sel.innerHTML = `<option value="">Todas</option>`;
    else sel.innerHTML = "";
    AGENCIAS.forEach(a => {
        const o = document.createElement("option");
        o.value = a.id;
        o.textContent = `${a.codigo} — ${a.nombre}`;
        sel.appendChild(o);
    });
}

function activarTabs() {
    $$(".tab-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            $$(".tab-btn").forEach(b => b.classList.remove("active"));
            $$(".tab").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            $(`#tab-${btn.dataset.tab}`).classList.add("active");
            // Cargar datos al cambiar de tab
            await onTabChange(btn.dataset.tab);
        });
    });
}

async function onTabChange(tab) {
    if (tab === "productos") return cargarProductos();
    if (tab === "venta")     return cargarProductos().then(renderSelectProductosVenta);
    if (tab === "compra")    return Promise.all([cargarProductos(), cargarProveedores(), cargarOrdenesPendientes()]).then(renderSelectProductosCompra);
    if (tab === "empleados") return cargarEmpleados();
    if (tab === "reportes")  return refrescarReportes();
}

// ====================================================================
// PRODUCTOS
// ====================================================================
async function cargarProductos() {
    try {
        state.productos = await api("/catalog/products");
        renderProductos();
    } catch (e) {
        toast("Error cargando productos: " + e.message, "err");
    }
}

function renderProductos() {
    const cont = $("#productos-lista");
    if (state.productos.length === 0) {
        cont.innerHTML = `<div class="empty">No hay productos. Crea el primero con el botón "+ Nuevo producto".</div>`;
        return;
    }
    cont.innerHTML = state.productos.map(p => `
        <div class="card">
            <h4>${p.nombre}</h4>
            <div class="meta">${p.codigo} · ${p.categoria}</div>
            ${p.descripcion ? `<div class="meta">${p.descripcion}</div>` : ""}
            <div class="price">$${p.precio_base} / ${p.unidad_medida}</div>
            <div style="margin-top:.5rem; text-align:right">
                <button class="btn-del" data-del="${p.id}">Eliminar</button>
            </div>
        </div>
    `).join("");
    cont.querySelectorAll("[data-del]").forEach(b => {
        b.addEventListener("click", () => eliminarProducto(b.dataset.del));
    });
}

async function eliminarProducto(id) {
    if (!confirm("¿Eliminar producto?")) return;
    try {
        await api(`/catalog/products/${id}`, { method: "DELETE" });
        toast("Producto eliminado");
        await cargarProductos();
    } catch (e) { toast(e.message, "err"); }
}

function abrirDialogo(id) { $(`#${id}`).showModal(); }

function setupDialogo(id, formId, onSubmit) {
    const dlg = $(`#${id}`);
    const form = $(`#${formId}`);
    dlg.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => dlg.close()));
    form.addEventListener("submit", async e => {
        e.preventDefault();
        try {
            const data = Object.fromEntries(new FormData(form));
            await onSubmit(data);
            form.reset();
            dlg.close();
        } catch (err) { toast(err.message, "err"); }
    });
}

// ====================================================================
// NUEVA VENTA
// ====================================================================
function renderSelectProductosVenta() {
    const sel = $("#venta-producto");
    sel.innerHTML = state.productos.map(p =>
        `<option value="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio_base}">${p.nombre} — $${p.precio_base}</option>`
    ).join("");
}

function agregarItemVenta() {
    const sel = $("#venta-producto");
    const opt = sel.selectedOptions[0];
    if (!opt) return;
    const cant = parseInt($("#venta-cantidad").value, 10);
    if (!cant || cant < 1) return toast("Cantidad inválida", "err");
    state.ventaCarrito.push({
        producto_id: opt.value,
        nombre: opt.dataset.nombre,
        precio_unitario: parseFloat(opt.dataset.precio),
        cantidad: cant,
    });
    renderCarritoVenta();
}

function renderCarritoVenta() {
    const tbody = $("#venta-items tbody");
    let total = 0;
    tbody.innerHTML = state.ventaCarrito.map((it, idx) => {
        const sub = it.precio_unitario * it.cantidad;
        total += sub;
        return `<tr>
            <td>${it.nombre}</td>
            <td>${it.cantidad}</td>
            <td>$${it.precio_unitario.toFixed(2)}</td>
            <td>$${sub.toFixed(2)}</td>
            <td><button class="btn-del" data-rm="${idx}">×</button></td>
        </tr>`;
    }).join("") || `<tr><td colspan="5" class="empty">Sin items</td></tr>`;
    $("#venta-total").textContent = "$" + total.toFixed(2);
    tbody.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => {
        state.ventaCarrito.splice(+b.dataset.rm, 1);
        renderCarritoVenta();
    }));
}

async function procesarVenta() {
    if (state.ventaCarrito.length === 0) return toast("Agrega al menos un item", "err");
    const payload = {
        agencia_id: state.agenciaActiva,
        cliente_nombre: $("#venta-cliente-nombre").value || null,
        cliente_documento: $("#venta-cliente-doc").value || null,
        metodo_pago: $("#venta-metodo").value,
        items: state.ventaCarrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
    };
    const res = $("#venta-resultado");
    res.className = "resultado visible";
    res.innerHTML = `<div>Procesando venta…</div>`;
    try {
        const venta = await api("/ventas/ventas", { method: "POST", body: JSON.stringify(payload) });
        // Pedimos la factura para mostrar el número correlativo bonito.
        let factura = null;
        try { factura = await api(`/facturacion/facturas/${venta.factura_id}`); } catch {}
        res.className = "resultado visible ok";
        res.innerHTML = `
            <h4>✓ Venta procesada — ${pill(venta.estado)}</h4>
            <div class="field">venta_id: ${venta.id}</div>
            <div class="field">total: $${venta.total}</div>
            <div class="field">pago_id: ${venta.pago_id || "-"}</div>
            ${factura ? `<div class="field">factura: <b>${factura.numero}</b> (IVA $${factura.iva}, total $${factura.total})</div>` : `<div class="field">factura_id: ${venta.factura_id || "-"}</div>`}
        `;
        toast("Venta completada");
        state.ventaCarrito = [];
        renderCarritoVenta();
    } catch (e) {
        res.className = "resultado visible err";
        res.innerHTML = `<h4>✗ Error</h4><div class="field">${e.message}</div>`;
        toast(e.message, "err");
    }
}

// ====================================================================
// NUEVA COMPRA
// ====================================================================
async function cargarProveedores() {
    try {
        state.proveedores = await api("/compras/proveedores");
        renderSelectProveedores();
    } catch (e) { toast("Error cargando proveedores: " + e.message, "err"); }
}

function renderSelectProveedores() {
    const sel = $("#compra-proveedor");
    if (state.proveedores.length === 0) {
        sel.innerHTML = `<option value="">— Sin proveedores —</option>`;
    } else {
        sel.innerHTML = state.proveedores.map(p =>
            `<option value="${p.id}">${p.nombre} (NIT ${p.nit})</option>`
        ).join("");
    }
}

function renderSelectProductosCompra() {
    const sel = $("#compra-producto");
    sel.innerHTML = state.productos.map(p =>
        `<option value="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio_base}">${p.nombre}</option>`
    ).join("");
    // Sugerir el precio base al cambiar producto.
    sel.addEventListener("change", () => {
        const opt = sel.selectedOptions[0];
        if (opt && !$("#compra-precio").value) $("#compra-precio").value = opt.dataset.precio;
    }, { once: true });
}

function agregarItemCompra() {
    const opt = $("#compra-producto").selectedOptions[0];
    if (!opt) return;
    const cant = parseInt($("#compra-cantidad").value, 10);
    const precio = parseFloat($("#compra-precio").value);
    if (!cant || cant < 1) return toast("Cantidad inválida", "err");
    if (!precio || precio < 0) return toast("Precio inválido", "err");
    state.compraCarrito.push({
        producto_id: opt.value,
        nombre: opt.dataset.nombre,
        cantidad: cant,
        precio_unitario: precio,
    });
    renderCarritoCompra();
}

function renderCarritoCompra() {
    const tbody = $("#compra-items tbody");
    let total = 0;
    tbody.innerHTML = state.compraCarrito.map((it, idx) => {
        const sub = it.precio_unitario * it.cantidad;
        total += sub;
        return `<tr>
            <td>${it.nombre}</td>
            <td>${it.cantidad}</td>
            <td>$${it.precio_unitario.toFixed(2)}</td>
            <td>$${sub.toFixed(2)}</td>
            <td><button class="btn-del" data-rm="${idx}">×</button></td>
        </tr>`;
    }).join("") || `<tr><td colspan="5" class="empty">Sin items</td></tr>`;
    $("#compra-total").textContent = "$" + total.toFixed(2);
    tbody.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => {
        state.compraCarrito.splice(+b.dataset.rm, 1);
        renderCarritoCompra();
    }));
}

async function crearOrdenCompra() {
    if (!$("#compra-proveedor").value) return toast("Selecciona un proveedor", "err");
    if (state.compraCarrito.length === 0) return toast("Agrega al menos un item", "err");
    try {
        const orden = await api("/compras/ordenes-compra", {
            method: "POST",
            body: JSON.stringify({
                proveedor_id: $("#compra-proveedor").value,
                agencia_destino_id: state.agenciaActiva,
                items: state.compraCarrito.map(i => ({
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario.toFixed(2),
                })),
            }),
        });
        toast("Orden creada: " + orden.id.slice(0, 8) + "...");
        state.compraCarrito = [];
        renderCarritoCompra();
        await cargarOrdenesPendientes();
    } catch (e) { toast(e.message, "err"); }
}

async function cargarOrdenesPendientes() {
    try {
        const ordenes = await api("/compras/ordenes-compra?estado=pendiente");
        const cont = $("#ordenes-pendientes");
        if (ordenes.length === 0) {
            cont.innerHTML = `<div class="empty">No hay órdenes pendientes</div>`;
            return;
        }
        cont.innerHTML = ordenes.map(o => {
            const prov = state.proveedores.find(p => p.id === o.proveedor_id);
            return `<div class="item">
                <div class="info">
                    <div class="titulo">${prov ? prov.nombre : o.proveedor_id.slice(0,8)+"..."} · $${o.total}</div>
                    <div class="sub">destino: ${nombreAgencia(o.agencia_destino_id)} · ${o.items.length} items</div>
                </div>
                <button class="btn-primary btn-action" data-rec="${o.id}">Recepcionar</button>
            </div>`;
        }).join("");
        cont.querySelectorAll("[data-rec]").forEach(b => b.addEventListener("click", () => recepcionar(b.dataset.rec)));
    } catch (e) { toast(e.message, "err"); }
}

async function recepcionar(id) {
    try {
        await api(`/compras/ordenes-compra/${id}/recepcion`, { method: "POST" });
        toast("Orden recepcionada. Stock actualizado y cuenta por pagar creada.");
        await cargarOrdenesPendientes();
    } catch (e) { toast(e.message, "err"); }
}

// ====================================================================
// EMPLEADOS
// ====================================================================
async function cargarEmpleados() {
    try {
        const filtro = $("#empleados-filtro").value;
        const url = filtro ? `/rrhh/empleados?agencia_id=${filtro}` : "/rrhh/empleados";
        const empleados = await api(url);
        const tbody = $("#empleados-tabla tbody");
        if (empleados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty">Sin empleados</td></tr>`;
            return;
        }
        tbody.innerHTML = empleados.map(e => `
            <tr>
                <td>${e.apellido}, ${e.nombre}</td>
                <td>${e.ci}</td>
                <td>${e.cargo}</td>
                <td>$${e.salario}</td>
                <td>${nombreAgencia(e.agencia_id)}</td>
                <td>${pill(String(e.activo))}</td>
                <td><button class="btn-del" data-del="${e.id}">Baja</button></td>
            </tr>
        `).join("");
        tbody.querySelectorAll("[data-del]").forEach(b => {
            b.addEventListener("click", () => darBajaEmpleado(b.dataset.del));
        });
    } catch (e) { toast(e.message, "err"); }
}

async function darBajaEmpleado(id) {
    if (!confirm("¿Dar de baja al empleado?")) return;
    try {
        await api(`/rrhh/empleados/${id}`, { method: "DELETE" });
        toast("Empleado dado de baja");
        await cargarEmpleados();
    } catch (e) { toast(e.message, "err"); }
}

// ====================================================================
// REPORTES
// ====================================================================
async function refrescarReportes() {
    const agenciaId = state.agenciaActiva;
    // Stock
    try {
        const stock = await api(`/almacen/stock?agencia_id=${agenciaId}`);
        const productosById = Object.fromEntries(state.productos.map(p => [p.id, p]));
        const cont = $("#reporte-stock");
        if (stock.length === 0) {
            cont.innerHTML = `<div class="empty">Sin stock en esta agencia</div>`;
        } else {
            cont.innerHTML = stock.map(s => {
                const p = productosById[s.producto_id];
                return `<div class="item">
                    <div class="info">
                        <div class="titulo">${p ? p.nombre : s.producto_id.slice(0,8)+"..."}</div>
                        <div class="sub">${p ? p.codigo + " · " + p.unidad_medida : ""}</div>
                    </div>
                    <div><b>${s.cantidad}</b></div>
                </div>`;
            }).join("");
        }
    } catch (e) { $("#reporte-stock").innerHTML = `<div class="empty">Error: ${e.message}</div>`; }

    // Ventas
    try {
        const ventas = await api(`/ventas/ventas?agencia_id=${agenciaId}`);
        const cont = $("#reporte-ventas");
        if (ventas.length === 0) {
            cont.innerHTML = `<div class="empty">Sin ventas en esta agencia</div>`;
        } else {
            cont.innerHTML = ventas.slice(0, 20).map(v => `
                <div class="item">
                    <div class="info">
                        <div class="titulo">$${v.total} ${pill(v.estado)}</div>
                        <div class="sub">${new Date(v.fecha).toLocaleString()} · ${v.cliente_nombre || "sin cliente"}</div>
                    </div>
                </div>
            `).join("");
        }
    } catch (e) { $("#reporte-ventas").innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

// ====================================================================
// Inicialización
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    poblarSelectAgencia($("#agencia"));
    poblarSelectAgencia($("#empleados-filtro"), true);
    poblarSelectAgencia(document.querySelector("#form-empleado select[name=agencia_id]"));

    $("#agencia").addEventListener("change", e => { state.agenciaActiva = e.target.value; });

    activarTabs();

    // Dialogos
    $("#btn-nuevo-producto").addEventListener("click", () => abrirDialogo("dialog-producto"));
    setupDialogo("dialog-producto", "form-producto", async (data) => {
        await api("/catalog/products", { method: "POST", body: JSON.stringify({
            codigo: data.codigo, nombre: data.nombre, descripcion: data.descripcion || null,
            categoria: data.categoria, unidad_medida: data.unidad_medida, precio_base: data.precio_base,
        })});
        toast("Producto creado");
        cargarProductos();
    });

    $("#btn-nuevo-proveedor").addEventListener("click", () => abrirDialogo("dialog-proveedor"));
    setupDialogo("dialog-proveedor", "form-proveedor", async (data) => {
        await api("/compras/proveedores", { method: "POST", body: JSON.stringify(data) });
        toast("Proveedor creado");
        cargarProveedores();
    });

    $("#btn-nuevo-empleado").addEventListener("click", () => abrirDialogo("dialog-empleado"));
    setupDialogo("dialog-empleado", "form-empleado", async (data) => {
        await api("/rrhh/empleados", { method: "POST", body: JSON.stringify(data) });
        toast("Empleado creado");
        cargarEmpleados();
    });
    $("#empleados-filtro").addEventListener("change", cargarEmpleados);

    // Ventas
    $("#venta-agregar").addEventListener("click", agregarItemVenta);
    $("#venta-procesar").addEventListener("click", procesarVenta);

    // Compras
    $("#compra-agregar").addEventListener("click", agregarItemCompra);
    $("#compra-crear").addEventListener("click", crearOrdenCompra);

    // Reportes
    $("#btn-refrescar-reportes").addEventListener("click", refrescarReportes);

    // Carga inicial de productos
    cargarProductos();
});
