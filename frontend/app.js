// Cliente JS mínimo para Tienda Abuela Serafina.
// Todas las llamadas pasan por el gateway en :8000.

const GATEWAY = "http://localhost:8000";

// Datos compartidos con los servicios (mismos UUIDs del seed)
const AGENCIAS = [
    { id: "660e8400-e29b-41d4-a716-446655440001", nombre: "Agencia Centro La Paz",  codigo: "A001" },
    { id: "660e8400-e29b-41d4-a716-446655440002", nombre: "Agencia Sopocachi",      codigo: "A002" },
    { id: "660e8400-e29b-41d4-a716-446655440003", nombre: "Agencia Equipetrol",     codigo: "A003" },
    { id: "660e8400-e29b-41d4-a716-446655440004", nombre: "Agencia Norte",          codigo: "A004" },
    { id: "660e8400-e29b-41d4-a716-446655440005", nombre: "Agencia Centro Cocha",   codigo: "A005" },
    { id: "660e8400-e29b-41d4-a716-446655440006", nombre: "Agencia Sur",            codigo: "A006" },
];

// Helper genérico para llamar al gateway
async function api(path, options = {}) {
    const resp = await fetch(`${GATEWAY}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
    }
    return resp.status === 204 ? null : resp.json();
}

// ------- Inicialización -------
function poblarAgencias() {
    const sel = document.getElementById("agencia");
    AGENCIAS.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = `${a.codigo} — ${a.nombre}`;
        sel.appendChild(opt);
    });
}

function activarTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        });
    });
}

// TODO(owner-frontend): cada función abajo es un stub para que el dueño del
// frontend la implemente — llamando a `api("/<servicio>/<path>")`.
async function cargarProductos()  { /* GET /catalog/products */ }
async function procesarVenta()    { /* POST /ventas/ventas */ }
async function crearOrdenCompra() { /* POST /compras/ordenes-compra */ }
async function cargarEmpleados()  { /* GET /rrhh/empleados?agencia_id=... */ }
async function cargarReportes()   { /* GET /almacen/stock + /ventas/ventas */ }

document.addEventListener("DOMContentLoaded", () => {
    poblarAgencias();
    activarTabs();
});
