let facturasGlobales = [];

window.initFacturacion = async () => {
    console.log("Iniciando módulo de Facturación...");
    await cargarFacturas();
};

window.cargarFacturas = async () => {
    const tbody = document.getElementById('tbody-facturas');
    
    if (!tbody) return; // Seguridad por si la vista aún no carga por completo
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Cargando facturas...</td></tr>';

    try {
        // La magia de tu Gateway: Pide a Nginx, Nginx pide a FastAPI
        facturasGlobales = await window.api('/facturacion/');

        tbody.innerHTML = '';

        if (facturasGlobales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No hay facturas emitidas todavía.</td></tr>';
            return;
        }

        // Ordenar de la más reciente a la más antigua
        facturasGlobales.sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));

        facturasGlobales.forEach(f => {
            const tr = document.createElement('tr');
            const fecha = new Date(f.fecha_emision).toLocaleString();
            
            tr.innerHTML = `
                <td><span class="badge bg-secondary">${f.numero}</span></td>
                <td>${fecha}</td>
                <td>${f.cliente_nombre || 'Consumidor Final'}</td>
                <td>${f.cliente_documento || 'S/N'}</td>
                <td>Bs ${parseFloat(f.subtotal).toFixed(2)}</td>
                <td>Bs ${parseFloat(f.iva).toFixed(2)}</td>
                <td><strong>Bs ${parseFloat(f.total).toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-sm btn-info text-white" onclick="verDetalleFactura('${f.id}')">
                        Ver Detalles
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error cargando facturas:", error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error de conexión: ${error.message}</td></tr>`;
    }
};

window.verDetalleFactura = (facturaId) => {
    const factura = facturasGlobales.find(f => f.id === facturaId);
    if (!factura) return;

    const listaItems = document.getElementById('lista-items-factura');
    const tituloModal = document.getElementById('modalFacturaTitulo');
    
    // Verificamos si los elementos existen Y si la variable 'bootstrap' está cargada
    if (listaItems && tituloModal && typeof bootstrap !== 'undefined') {
        tituloModal.innerText = `Factura: ${factura.numero}`;
        listaItems.innerHTML = factura.items_json.map(item => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${item.cantidad}x</strong> ${item.producto_nombre}
                    <br><small class="text-muted">P.U: Bs ${parseFloat(item.precio_unitario).toFixed(2)}</small>
                </div>
                <span>Bs ${parseFloat(item.subtotal).toFixed(2)}</span>
            </li>
        `).join('');

        // Disparar modal nativo de Bootstrap
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleFactura'));
        modal.show();
    } else {
        // Fallback: Si Bootstrap no está definido, mostramos una alerta nativa limpia
        const detalleTexto = factura.items_json.map(i => `${i.cantidad}x ${i.producto_nombre} - Bs ${parseFloat(i.subtotal).toFixed(2)}`).join('\n');
        alert(`🧾 FACTURA: ${factura.numero}\n\n${detalleTexto}\n\n💰 TOTAL PAGADO: Bs ${parseFloat(factura.total).toFixed(2)}`);
    }
};