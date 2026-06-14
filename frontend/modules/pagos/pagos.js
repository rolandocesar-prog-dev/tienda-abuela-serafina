window.initPagos = async () => {
    console.log("Iniciando módulo de Pagos...");
    // Carga las dos tablas automáticamente al abrir la vista
    await Promise.all([
        cargarCuentasCobrar(),
        cargarCuentasPagar(),
        cargarPagosRealizados()
    ]);
};

// --- TABLA 1: VENTAS (COBROS) ---
window.cargarCuentasCobrar = async () => {
    const tbody = document.getElementById('tbody-cuentas-cobrar');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3">Cargando...</td></tr>';

    try {
        const cuentas = await window.api('/pagos/cuentas-por-cobrar');
        tbody.innerHTML = '';

        if (cuentas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay cuentas por cobrar.</td></tr>';
            return;
        }

        cuentas.forEach(c => {
            const estadoBadge = c.estado === 'pagada' ? 'bg-success' : 'bg-warning text-dark';
            tbody.innerHTML += `
                <tr>
                    <td>${c.cliente_nombre}</td>
                    <td>Bs ${parseFloat(c.monto_total).toFixed(2)}</td>
                    <td>Bs ${parseFloat(c.monto_pagado).toFixed(2)}</td>
                    <td><span class="badge ${estadoBadge}">${c.estado.toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="prepararPago('venta', '${c.venta_id}', ${c.monto_total - c.monto_pagado})"
                                ${c.estado === 'pagada' ? 'disabled' : ''}>
                            Cobrar
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
};

// --- TABLA 2: COMPRAS (PAGOS A PROVEEDORES) ---
window.cargarCuentasPagar = async () => {
    const tbody = document.getElementById('tbody-cuentas-pagar');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3">Cargando...</td></tr>';

    try {
        const cuentas = await window.api('/pagos/cuentas-por-pagar?estado=pendiente');
        tbody.innerHTML = '';

        if (cuentas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay deudas con proveedores.</td></tr>';
            return;
        }

        cuentas.forEach(c => {
            const estadoBadge = c.estado === 'pagada' ? 'bg-success' : 'bg-danger';
            // Acortar el UUID para que se vea mejor en la tabla
            const shortId = c.proveedor_id.split('-')[0]; 
            
            tbody.innerHTML += `
                <tr>
                    <td><span title="${c.proveedor_id}">${shortId}...</span></td>
                    <td>Bs ${parseFloat(c.monto_total).toFixed(2)}</td>
                    <td>Bs ${parseFloat(c.monto_pagado).toFixed(2)}</td>
                    <td><span class="badge ${estadoBadge}">${c.estado.toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="prepararPago('compra', '${c.orden_compra_id}', ${c.monto_total - c.monto_pagado})"
                                ${c.estado === 'pagada' ? 'disabled' : ''}>
                            Pagar
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
};

// --- FORMULARIO AUTOMÁTICO ---
window.prepararPago = (tipo, referenciaId, montoPendiente) => {
    // Al hacer clic en una tabla, se llena el formulario automáticamente
    document.getElementById('pago-tipo').value = tipo;
    document.getElementById('pago-referencia').value = referenciaId;
    document.getElementById('pago-monto').value = parseFloat(montoPendiente).toFixed(2);
    
    // Resaltar visualmente el formulario
    document.getElementById('pago-monto').focus();
};

// --- PROCESAMIENTO ---
window.procesarPago = async (event) => {
    event.preventDefault();

    const btn = document.getElementById('btn-procesar');

    btn.disabled = true;
    btn.innerHTML = 'Procesando...';

    const payload = {
        tipo: document.getElementById('pago-tipo').value,
        referencia_id: document.getElementById('pago-referencia').value,
        monto: parseFloat(document.getElementById('pago-monto').value),
        metodo: document.getElementById('pago-metodo').value
    };

    try {

        const respuesta = await window.api(
            '/pagos/pagos',
            {
                method: 'POST',
                body: JSON.stringify(payload)
            }
        );

        alert(
            `✅ Pago registrado con éxito. Estado: ${respuesta.estado.toUpperCase()}`
        );

        document.getElementById('form-pago').reset();

        await cargarCuentasCobrar();
        await cargarCuentasPagar();
        await cargarPagosRealizados();

    } catch (error) {

        alert(
            `❌ Error al procesar el pago: ${error.message}`
        );

    } finally {

        btn.disabled = false;
        btn.innerText = 'Procesar Pago';

    }
};

window.cargarPagosRealizados = async () => {

    const tbody =
        document.getElementById(
            'tbody-pagos-realizados'
        );

    if (!tbody) return;

    try {

        const cuentas = await window.api(
            '/pagos/cuentas-por-pagar?estado=pagada'
        );

        tbody.innerHTML = '';

        if (cuentas.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center text-success py-3">🎉 No existen cuentas pendientes.</td></tr>';
            return;
        }

        cuentas.forEach(c => {

            tbody.innerHTML += `
                <tr>
                    <td>${c.proveedor_id}</td>
                    <td>Bs ${parseFloat(c.monto_total).toFixed(2)}</td>
                    <td>Bs ${parseFloat(c.monto_pagado).toFixed(2)}</td>
                    <td>
                        <span class="badge bg-success">
                            PAGADA
                        </span>
                    </td>
                </tr>
            `;
        });

    } catch (error) {

        console.error(
            'Error cargando historial:',
            error
        );
    }
};