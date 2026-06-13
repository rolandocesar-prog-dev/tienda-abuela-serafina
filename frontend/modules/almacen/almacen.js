window.initAlmacen = async function() {
    const tbody = document.getElementById('almacen-body');
    const form = document.getElementById('form-movimiento');
    const sProducto = document.getElementById('producto_id');
    const sAgencia = document.getElementById('agencia_id');

    async function cargarCatalogos() {
        // Ejecución en paralelo controlada
        const [resProductos, resAgencias] = await Promise.allSettled([
            api('/catalog/productos'), 
            api('/rrhh/agencias') 
        ]);
        
        // Cargar Productos
        if (resProductos.status === 'fulfilled') {
            sProducto.innerHTML = resProductos.value.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        } else {
            console.error("Fallo al cargar productos:", resProductos.reason);
            sProducto.innerHTML = '<option value="">Error cargando productos</option>';
        }

        // Cargar Agencias
        if (resAgencias.status === 'fulfilled') {
            sAgencia.innerHTML = resAgencias.value.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
        } else {
            console.error("Fallo al cargar agencias:", resAgencias.reason);
            sAgencia.innerHTML = '<option value="">Error cargando agencias</option>';
        }
    }

    async function cargarStock() {
        try {
            const data = await api('/almacen/stock');
            tbody.innerHTML = data.length ? data.map(item => `
                <tr>
                    <td>${item.producto_id}</td>
                    <td>${item.agencia_id}</td>
                    <td><span class="badge bg-primary">${item.cantidad}</span></td>
                </tr>
            `).join('') : '<tr><td colspan="3" class="text-center">Sin stock.</td></tr>';
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Error cargando stock.</td></tr>`;
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            tipo: document.getElementById('tipo').value,
            agencia_id: sAgencia.value,
            producto_id: sProducto.value,
            cantidad: parseInt(document.getElementById('cantidad').value)
        };
        
        try {
            await api('/almacen/movimientos', { method: 'POST', body: JSON.stringify(payload) });
            form.reset();
            cargarStock();
        } catch (e) {
            alert("Error al registrar: " + e.message);
        }
    };

    await cargarCatalogos();
    cargarStock();
};