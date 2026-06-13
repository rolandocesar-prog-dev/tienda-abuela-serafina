// Estado local del módulo
let listaProductos = [];
let idEditando = null;

// Inicialización del módulo
function initCatalog() {
    console.log("Inicializando Catálogo...");

    const btnToggle = document.getElementById("btn-toggle-form");
    const btnActualizar = document.getElementById("btn-actualizar");
    const btnCancelar = document.getElementById("btn-cancelar");
    const form = document.getElementById("form-nuevo-producto");
    const tabla = document.getElementById("tabla-productos");
    const buscador = document.getElementById("buscador");
    

    if (!btnToggle || !form || !tabla) {
        console.error("No se encontraron elementos del módulo catálogo.");
        return;
    }

    btnToggle.onclick = toggleForm;

    if (btnActualizar) {
        btnActualizar.onclick = cargarProductos;
    }

    if (btnCancelar) {
        btnCancelar.onclick = toggleForm;
    }

    form.onsubmit = crearProducto;

    if (buscador) {
        buscador.onkeyup = filtrarProductos;
    }

    tabla.onclick = (e) => {

        const btn = e.target.closest("button");

        if (!btn) return;

        const id = btn.dataset.id;

        if (btn.classList.contains("btn-warning")) {
            editarProducto(id);
        }

        if (btn.classList.contains("btn-danger")) {
            eliminarProducto(id);
        }
    };

    cargarProductos();
}

// Renderizar tabla
function renderizarTabla(datos) {
    const tbody = document.getElementById("tabla-productos");

    if (!tbody) return;

    if (!datos.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    No hay productos registrados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = datos.map(p => `
        <tr>
            <td class="fw-bold text-secondary">
                ${p.codigo}
            </td>

            <td>
                ${p.nombre}
            </td>

            <td>
                ${p.descripcion || "-"}
            </td>

            <td>
                Bs. ${Number(p.precio_base || 0).toFixed(2)}
            </td>

            <td class="text-center">
                <button
                    class="btn btn-sm btn-warning me-1"
                    data-id="${p.id}">
                    ✏️
                </button>

                <button
                    class="btn btn-sm btn-danger"
                    data-id="${p.id}">
                    🗑️
                </button>
            </td>
        </tr>
    `).join("");
}

// Obtener productos
async function cargarProductos() {
    try {

        listaProductos = await window.api(
            "/catalog/products"
        );

        renderizarTabla(listaProductos);

    } catch (error) {

        console.error(
            "Error cargando productos:",
            error
        );
    }
}

// Mostrar / ocultar formulario
function toggleForm() {

    const container =
        document.getElementById(
            "container-form-nuevo"
        );

    if (!container) return;

    container.classList.toggle("d-none");

    if (container.classList.contains("d-none")) {

        idEditando = null;

        document
            .getElementById("form-nuevo-producto")
            .reset();

        document
            .getElementById("prod-codigo")
            .disabled = false;
    }
}

// Crear o actualizar producto
async function crearProducto(event) {

    event.preventDefault();

    try {

        const codigo = document
            .getElementById("prod-codigo")
            .value
            .trim();

        const existe = listaProductos.some(
            p =>
                p.codigo.toLowerCase() === codigo.toLowerCase() &&
                p.id !== idEditando
        );

        if (existe) {

            const error =
                document.getElementById("form-error");

            error.textContent =
                "Ya existe un producto con ese código.";

            error.classList.remove("d-none");

            return;
        }

        document
            .getElementById("form-error")
            .classList.add("d-none");

        const payload = {
            codigo,
            nombre: document.getElementById("prod-nombre").value,
            categoria: document.getElementById("prod-categoria").value,
            unidad_medida: document.getElementById("prod-unidad").value,
            descripcion: document.getElementById("prod-desc").value,
            precio_base: parseFloat(
                document.getElementById("prod-precio").value
            )
        };

        const url = idEditando
            ? `/catalog/products/${idEditando}`
            : "/catalog/products";

        const method = idEditando
            ? "PUT"
            : "POST";

        await window.api(url, {
            method,
            body: JSON.stringify(payload)
        });

        toggleForm();

        await cargarProductos();

    } catch (error) {

        console.error(
            "Error guardando producto:",
            error
        );
    }
}

// Editar producto
function editarProducto(id) {

    const prod = listaProductos.find(
        p => p.id === id
    );

    if (!prod) {
        console.error("No se encontró el producto");
        return;
    }

    idEditando = prod.id;

    document.getElementById("prod-codigo").value = prod.codigo;
    document.getElementById("prod-codigo").disabled = true;

    document.getElementById("prod-nombre").value = prod.nombre || "";
    document.getElementById("prod-categoria").value = prod.categoria || "";
    document.getElementById("prod-unidad").value = prod.unidad_medida || "";
    document.getElementById("prod-desc").value = prod.descripcion || "";
    document.getElementById("prod-precio").value = prod.precio_base || 0;

    const container =
        document.getElementById("container-form-nuevo");

    if (container.classList.contains("d-none")) {
        toggleForm();
    }
}

// Eliminar producto
async function eliminarProducto(id) {

    if (!confirm(
        "¿Estás seguro de eliminar este producto?"
    )) {
        return;
    }

    try {

        await window.api(
            `/catalog/products/${id}`,
            {
                method: "DELETE"
            }
        );

        await cargarProductos();

    } catch (error) {

        console.error(
            "Error eliminando producto:",
            error
        );
    }
}

// Buscador local
function filtrarProductos() {

    const texto =
        document
            .getElementById("buscador")
            .value
            .toLowerCase();

    const filtrados =
        listaProductos.filter(p =>
            p.nombre.toLowerCase().includes(texto) ||
            p.codigo.toLowerCase().includes(texto)
        );

    renderizarTabla(filtrados);
}

// Exponer inicializador al app.js
window.initCatalog = initCatalog;