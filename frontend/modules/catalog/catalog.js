window.initCatalog = async function() {
    console.log("Inicializando Catálogo...");

    let listaProductos = [];
    let idEditando = null;

    const btnToggle = document.getElementById("btn-toggle-form");
    const btnCancelar = document.getElementById("btn-cancelar");
    const form = document.getElementById("form-nuevo-producto");
    const tabla = document.getElementById("tabla-productos");
    const buscador = document.getElementById("buscador");

    // --- Funciones Internas ---

    async function cargarProductos() {
        try {
            const productos = await api('/catalog/productos');
            listaProductos = productos;
            renderizarTabla(productos);
        } catch (e) {
            console.error("Error cargando productos:", e);
        }
    }

    function renderizarTabla(datos) {
        const tbody = document.getElementById("tabla-productos");
        if (!tbody) return;

        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay productos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(p => `
            <tr>
                <td class="fw-bold text-secondary">${p.codigo}</td>
                <td>${p.nombre}</td>
                <td>${p.descripcion || "-"}</td>
                <td>Bs. ${Number(p.precio_base || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-warning me-1 btn-editar" data-id="${p.id}">✏️</button>
                    <button class="btn btn-sm btn-danger btn-eliminar" data-id="${p.id}">🗑️</button>
                </td>
            </tr>
        `).join("");
    }

    async function crearProducto(event) {
        event.preventDefault();
        try {
            const payload = {
                codigo: document.getElementById("prod-codigo").value.trim(),
                nombre: document.getElementById("prod-nombre").value,
                categoria: document.getElementById("prod-categoria").value,
                unidad_medida: document.getElementById("prod-unidad").value,
                descripcion: document.getElementById("prod-desc").value,
                precio_base: parseFloat(document.getElementById("prod-precio").value)
            };

            const url = idEditando ? `/catalog/productos/${idEditando}` : "/catalog/productos";
            const method = idEditando ? "PUT" : "POST";

            await api(url, { method, body: JSON.stringify(payload) });
            toggleForm();
            await cargarProductos();
        } catch (error) {
            console.error("Error guardando producto:", error);
        }
    }

    // --- Lógica de Edición y Eliminación ---
    tabla.onclick = async (e) => {
        if (e.target.classList.contains("btn-editar")) {
            const id = e.target.dataset.id;
            const prod = listaProductos.find(p => p.id === id);
            if (prod) {
                idEditando = prod.id;
                document.getElementById("prod-codigo").value = prod.codigo;
                document.getElementById("prod-codigo").disabled = true;
                document.getElementById("prod-nombre").value = prod.nombre;
                document.getElementById("prod-categoria").value = prod.categoria;
                document.getElementById("prod-unidad").value = prod.unidad_medida;
                document.getElementById("prod-desc").value = prod.descripcion;
                document.getElementById("prod-precio").value = prod.precio_base;
                toggleForm();
            }
        }
        if (e.target.classList.contains("btn-eliminar")) {
            const id = e.target.dataset.id;
            if (confirm("¿Seguro que deseas eliminar este producto?")) {
                await api(`/catalog/productos/${id}`, { method: "DELETE" });
                await cargarProductos();
            }
        }
    };

    // --- Event Listeners ---
    if (btnToggle) btnToggle.onclick = toggleForm;
    if (btnCancelar) btnCancelar.onclick = toggleForm;
    if (form) form.onsubmit = crearProducto;
    if (buscador) buscador.onkeyup = () => {
        const texto = buscador.value.toLowerCase();
        renderizarTabla(listaProductos.filter(p => p.nombre.toLowerCase().includes(texto) || p.codigo.toLowerCase().includes(texto)));
    };

    function toggleForm() {
        const container = document.getElementById("container-form-nuevo");
        if (!container) return;
        container.classList.toggle("d-none");
        if (container.classList.contains("d-none")) {
            idEditando = null;
            form.reset();
            document.getElementById("prod-codigo").disabled = false;
        }
    }

    await cargarProductos();
};