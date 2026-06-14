window.productosCompra = window.productosCompra || [];
window.proveedoresCompra = window.proveedoresCompra || [];
window.draftItems = window.draftItems || [];

// --- CONTROLADOR MANUAL DE PESTAÑAS ---
window.cambiarPestana = (tabId, btn) => {
    // 1. Quitar la clase 'active' de todos los botones
    document.querySelectorAll('#comprasTabs .nav-link').forEach(b => b.classList.remove('active'));
    // 2. Poner 'active' solo al botón presionado
    btn.classList.add('active');

    // 3. Ocultar todos los paneles de contenido
    document.querySelectorAll('#comprasTabsContent .tab-pane').forEach(p => {
        p.classList.remove('show', 'active');
    });
    // 4. Mostrar el panel correspondiente al ID
    document.getElementById(tabId).classList.add('show', 'active');
};

window.initCompras = async () => {
    console.log("Iniciando módulo de Compras...");
    await Promise.all([
        window.cargarProveedores(),
        window.cargarProductosCatalog(),
        window.cargarOrdenes()
    ]);
};

// --- CARGA DE DATOS INICIALES ---
window.cargarProveedores = async () => {
    try {

        window.proveedoresCompra =
            await window.api('/compras/proveedores');

        console.log(
            'Proveedores recibidos:',
            window.proveedoresCompra
        );

        const tbody =
            document.getElementById('tbody-proveedores');

        const select =
            document.getElementById('select-proveedor');

        console.log('tbody:', tbody);
        console.log('select:', select);

        if (!tbody || !select) return;

        tbody.innerHTML = '';
        select.innerHTML =
            '<option value="">Seleccione un proveedor...</option>';

        window.proveedoresCompra.forEach(p => {

            tbody.innerHTML += `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${p.nit}</td>
                    <td>${p.telefono || '-'} / ${p.email || '-'}</td>
                </tr>
            `;

            select.innerHTML += `
                <option value="${p.id}">
                    ${p.nombre}
                </option>
            `;
        });

    } catch (error) {
        console.error(
            "Error cargando proveedores:",
            error
        );
    }
};

window.cargarProductosCatalog = async () => {
    try {
        window.productosCompra = await window.api('/catalog/productos');
        const select = document.getElementById('select-producto');
        if(!select) return;

        select.innerHTML = '<option value="">Seleccione un producto...</option>';
        window.productosCompra.forEach(p => {
            select.innerHTML += `<option value="${p.id}" data-nombre="${p.nombre}">${p.nombre}</option>`;
        });
    } catch (error) { console.error("Error cargando productos de catálogo:", error); }
};

// --- GESTIÓN DE PROVEEDORES ---
window.crearProveedor = async (e) => {
    e.preventDefault();
    const payload = {
        nombre: document.getElementById('prov-nombre').value,
        nit: document.getElementById('prov-nit').value,
        telefono: document.getElementById('prov-telefono').value,
        email: document.getElementById('prov-email').value
    };
    try {
        await window.api('/compras/proveedores', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        alert('Proveedor creado exitosamente');
        document.getElementById('form-proveedor').reset();
        await cargarProveedores();
    } catch (error) { alert('Error: ' + error.message); }
};

// --- CREACIÓN DE ORDEN DE COMPRA ---
window.agregarItem = (e) => {
    e.preventDefault();
    const selectProd = document.getElementById('select-producto');
    const idProd = selectProd.value;
    const nombreProd = selectProd.options[selectProd.selectedIndex].text;
    const cant = parseInt(document.getElementById('input-cantidad').value);
    const costo = parseFloat(document.getElementById('input-costo').value);

    if (!idProd) return alert("Seleccione un producto");

    window.draftItems.push({
        producto_id: idProd,
        nombre: nombreProd,
        cantidad: cant,
        precio_unitario: costo,
        subtotal: cant * costo
    });

    window.renderDraft();
    document.getElementById('form-add-item').reset();
};

window.renderDraft = () => {
    const tbody = document.getElementById('tbody-draft');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    let total = 0;

    window.draftItems.forEach((item, index) => {
        total += item.subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>Bs ${item.precio_unitario.toFixed(2)}</td>
                <td>Bs ${item.subtotal.toFixed(2)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="quitarItem(${index})"><i class="bi bi-trash"></i></button></td>
            </tr>
        `;
    });
    document.getElementById('total-draft').innerText = `Total: Bs ${total.toFixed(2)}`;
};

window.quitarItem = (index) => {
    window.draftItems.splice(index, 1);
    window.renderDraft();
};

window.crearOrdenCompra = async () => {
    const proveedor_id = document.getElementById('select-proveedor').value;
    const agencia_destino_id = document.getElementById('input-agencia').value;

    if (!proveedor_id || window.draftItems.length === 0) {
        return alert("Seleccione un proveedor y agregue al menos un producto.");
    }

    const payload = {
        proveedor_id: proveedor_id,
        agencia_destino_id: agencia_destino_id,
        items: window.draftItems.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
    };

    try {
        await window.api('/compras/ordenes-compra', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        alert('Orden de compra emitida correctamente (Estado: Pendiente)');
        window.draftItems = [];
        window.renderDraft();
        await window.cargarOrdenes();
        
        // Cambiar a la pestaña de historial usando nuestra nueva función
        window.cambiarPestana('tab-historial', document.getElementById('btn-tab-historial'));
    } catch (error) { alert("Error al emitir orden: " + error.message); }
};

// --- HISTORIAL Y ORQUESTACIÓN ---
window.cargarOrdenes = async () => {
    try {
        const ordenes = await window.api('/compras/ordenes-compra');
        const tbody = document.getElementById('tbody-ordenes');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        // Ordenar más recientes primero
        ordenes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        ordenes.forEach(o => {
            const fecha = new Date(o.fecha).toLocaleString();
            const badge = o.estado === 'recibida' ? 'bg-success' : 'bg-warning text-dark';
            
            // Botón mágico: Solo aparece si está pendiente
            const btnRecepcion = o.estado === 'pendiente' 
                ? `<button class="btn btn-sm btn-success shadow-sm" onclick="recepcionarOrden('${o.id}')">
                     <i class="bi bi-box-seam"></i> Recepcionar Mercadería
                   </button>` 
                : `<span class="text-muted"><i class="bi bi-check-circle"></i> Procesada</span>`;

            tbody.innerHTML += `
                <tr class="align-middle">
                    <td>${fecha}</td>
                    <td><small title="${o.id}">${o.id.split('-')[0]}...</small></td>
                    <td><strong>Bs ${parseFloat(o.total).toFixed(2)}</strong></td>
                    <td><span class="badge ${badge}">${o.estado.toUpperCase()}</span></td>
                    <td>${btnRecepcion}</td>
                </tr>
            `;
        });
    } catch (error) { console.error("Error cargando órdenes:", error); }
};

window.recepcionarOrden = async (ordenId) => {
    if (!confirm("¿Confirmar recepción?\n\nEsto hará que:\n1. Se sumen los productos a tu ALMACÉN.\n2. Se registre la deuda en PAGOS.")) return;

    try {
        await window.api(
            `/compras/ordenes-compra/${ordenId}/recepcion`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        );
        alert("¡Recepción exitosa!\nEl stock ha sido actualizado y la deuda se envió a tesorería.");
        await window.cargarOrdenes();
    } catch (error) { 
        alert("Error en la orquestación: " + error.message); 
    }
};