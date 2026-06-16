// Facturación Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let facturasGlobales = [];
    let currentPageFacturas = 1;
    let itemsPerPageFacturas = 10;
    let currentFiltersFacturas = {
        search: '',
        fechaDesde: '',
        fechaHasta: '',
        montoMin: ''
    };
    
    /**
     * Inicializar módulo de facturación
     */
    window.initFacturacion = async () => {
        console.log("🧾 Iniciando módulo de Facturación...");
        await cargarFacturas();
        configurarEventosFacturacion();
    };
    
    /**
     * Configurar eventos
     */
    function configurarEventosFacturacion() {
        const btnAplicar = document.getElementById('btn-aplicar-filtros');
        const btnLimpiar = document.getElementById('btn-limpiar-filtros');
        const buscador = document.getElementById('buscador-facturas');
        
        const aplicar = () => {
            aplicarFiltros();
        };
        
        if (btnAplicar) btnAplicar.addEventListener('click', aplicar);
        if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltros);
        if (buscador) buscador.addEventListener('input', aplicar);
        
        document.getElementById('filtro-fecha-desde')?.addEventListener('change', aplicar);
        document.getElementById('filtro-fecha-hasta')?.addEventListener('change', aplicar);
        document.getElementById('filtro-monto-min')?.addEventListener('input', aplicar);
    }
    
    /**
     * Aplicar filtros
     */
    function aplicarFiltros() {
        currentFiltersFacturas.search = document.getElementById('buscador-facturas')?.value || '';
        currentFiltersFacturas.fechaDesde = document.getElementById('filtro-fecha-desde')?.value || '';
        currentFiltersFacturas.fechaHasta = document.getElementById('filtro-fecha-hasta')?.value || '';
        currentFiltersFacturas.montoMin = document.getElementById('filtro-monto-min')?.value || '';
        currentPageFacturas = 1;
        renderizarFacturas();
    }
    
    /**
     * Limpiar filtros
     */
    function limpiarFiltros() {
        const buscador = document.getElementById('buscador-facturas');
        const fechaDesde = document.getElementById('filtro-fecha-desde');
        const fechaHasta = document.getElementById('filtro-fecha-hasta');
        const montoMin = document.getElementById('filtro-monto-min');
        
        if (buscador) buscador.value = '';
        if (fechaDesde) fechaDesde.value = '';
        if (fechaHasta) fechaHasta.value = '';
        if (montoMin) montoMin.value = '';
        
        currentFiltersFacturas = {
            search: '',
            fechaDesde: '',
            fechaHasta: '',
            montoMin: ''
        };
        currentPageFacturas = 1;
        renderizarFacturas();
        window.mostrarNotificacion('Filtros limpiados', 'info');
    }
    
    /**
     * Cargar facturas desde API
     */
    window.cargarFacturas = async () => {
        const tbody = document.getElementById('tbody-facturas');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Cargando facturas...</p></div></td>';

        try {
            facturasGlobales = await window.api('/facturacion/facturas');
            
            if (facturasGlobales.length === 0) {
                tbody.innerHTML = '<td><td colspan="8" class="text-center py-5 text-muted">No hay facturas emitidas todavía. </td>';
                actualizarEstadisticas([]);
                return;
            }
            
            facturasGlobales.sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
            
            actualizarEstadisticas(facturasGlobales);
            renderizarFacturas();
            
        } catch (error) {
            console.error("Error cargando facturas:", error);
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error de conexión: ${error.message} </td>`;
            window.mostrarNotificacion('Error cargando facturas: ' + error.message, 'error');
        }
    };
    
    /**
     * Actualizar estadísticas del dashboard
     */
    function actualizarEstadisticas(facturas) {
        const totalFacturas = facturas.length;
        const totalFacturado = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
        
        const hoy = new Date().toISOString().split('T')[0];
        const facturasHoy = facturas.filter(f => f.fecha_emision?.split('T')[0] === hoy).length;
        
        const promedioFactura = totalFacturas > 0 ? totalFacturado / totalFacturas : 0;
        
        const totalFacturasEl = document.getElementById('total-facturas');
        const totalFacturadoEl = document.getElementById('total-facturado');
        const facturasHoyEl = document.getElementById('facturas-hoy');
        const promedioFacturaEl = document.getElementById('promedio-factura');
        
        if (totalFacturasEl) totalFacturasEl.textContent = totalFacturas;
        if (totalFacturadoEl) totalFacturadoEl.textContent = `Bs ${totalFacturado.toFixed(2)}`;
        if (facturasHoyEl) facturasHoyEl.textContent = facturasHoy;
        if (promedioFacturaEl) promedioFacturaEl.textContent = `Bs ${promedioFactura.toFixed(2)}`;
    }
    
    /**
     * Renderizar facturas con paginación y filtros
     */
    function renderizarFacturas() {
        const tbody = document.getElementById('tbody-facturas');
        if (!tbody) return;
        
        let facturasFiltradas = [...facturasGlobales];
        
        if (currentFiltersFacturas.search) {
            const searchTerm = currentFiltersFacturas.search.toLowerCase();
            facturasFiltradas = facturasFiltradas.filter(f => 
                f.numero?.toLowerCase().includes(searchTerm) ||
                f.cliente_nombre?.toLowerCase().includes(searchTerm) ||
                f.cliente_documento?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (currentFiltersFacturas.fechaDesde) {
            const fechaDesde = new Date(currentFiltersFacturas.fechaDesde);
            facturasFiltradas = facturasFiltradas.filter(f => {
                const fechaFactura = new Date(f.fecha_emision);
                return fechaFactura >= fechaDesde;
            });
        }
        
        if (currentFiltersFacturas.fechaHasta) {
            const fechaHasta = new Date(currentFiltersFacturas.fechaHasta);
            fechaHasta.setHours(23, 59, 59);
            facturasFiltradas = facturasFiltradas.filter(f => {
                const fechaFactura = new Date(f.fecha_emision);
                return fechaFactura <= fechaHasta;
            });
        }
        
        if (currentFiltersFacturas.montoMin && currentFiltersFacturas.montoMin > 0) {
            const montoMin = parseFloat(currentFiltersFacturas.montoMin);
            facturasFiltradas = facturasFiltradas.filter(f => parseFloat(f.total) >= montoMin);
        }
        
        const totalItems = facturasFiltradas.length;
        const totalPages = Math.ceil(totalItems / itemsPerPageFacturas);
        const start = (currentPageFacturas - 1) * itemsPerPageFacturas;
        const end = start + itemsPerPageFacturas;
        const facturasPagina = facturasFiltradas.slice(start, end);
        
        if (facturasPagina.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox" style="font-size: 3rem;"></i><p class="mt-2">No hay facturas que coincidan con los filtros</p></div></td>';
            renderizarPaginacionFacturas(totalPages);
            return;
        }
        
        tbody.innerHTML = facturasPagina.map(f => {
            const fecha = new Date(f.fecha_emision).toLocaleString();
            return `
                <tr>
                    <td><span class="badge-factura">${escapeHtmlFactura(f.numero || '-')}</span></div>
                    <td>${fecha}</div>
                    <td><strong>${escapeHtmlFactura(f.cliente_nombre || 'Consumidor Final')}</strong></div>
                    <td>${escapeHtmlFactura(f.cliente_documento || 'S/N')}</div>
                    <td>Bs ${parseFloat(f.subtotal || 0).toFixed(2)}</div>
                    <td>Bs ${parseFloat(f.iva || 0).toFixed(2)}</div>
                    <td class="text-primary fw-bold">Bs ${parseFloat(f.total || 0).toFixed(2)}</div>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-icon" onclick="verDetalleFactura('${f.id}')" title="Ver detalle">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </tr>
            `;
        }).join('');
        
        renderizarPaginacionFacturas(totalPages);
    }
    
    /**
     * Renderizar paginación
     */
    function renderizarPaginacionFacturas(totalPages) {
        const container = document.getElementById('pagination-container');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let html = `
            <nav>
                <ul class="pagination">
                    <li class="page-item ${currentPageFacturas === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaFacturas(${currentPageFacturas - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </li>
        `;
        
        let startPage = Math.max(1, currentPageFacturas - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${currentPageFacturas === i ? 'active' : ''}">
                    <button class="page-link" onclick="cambiarPaginaFacturas(${i})">${i}</button>
                </li>
            `;
        }
        
        html += `
                    <li class="page-item ${currentPageFacturas === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaFacturas(${currentPageFacturas + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </li>
                </ul>
            </nav>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * Cambiar página
     */
    window.cambiarPaginaFacturas = function(page) {
        currentPageFacturas = page;
        renderizarFacturas();
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };
    
    /**
     * Ver detalle de factura
     */
    window.verDetalleFactura = (facturaId) => {
        const factura = facturasGlobales.find(f => f.id === facturaId);
        if (!factura) return;
        
        const tituloModal = document.getElementById('modalFacturaTitulo');
        const detalleNumero = document.getElementById('detalle-numero');
        const detalleFecha = document.getElementById('detalle-fecha');
        const detalleCliente = document.getElementById('detalle-cliente');
        const detalleDocumento = document.getElementById('detalle-documento');
        const listaItems = document.getElementById('lista-items-factura');
        const detalleSubtotal = document.getElementById('detalle-subtotal');
        const detalleIva = document.getElementById('detalle-iva');
        const detalleTotal = document.getElementById('detalle-total');
        
        if (tituloModal) tituloModal.innerText = `Factura: ${factura.numero}`;
        if (detalleNumero) detalleNumero.innerText = factura.numero || '-';
        if (detalleFecha) detalleFecha.innerText = new Date(factura.fecha_emision).toLocaleString();
        if (detalleCliente) detalleCliente.innerText = factura.cliente_nombre || 'Consumidor Final';
        if (detalleDocumento) detalleDocumento.innerText = factura.cliente_documento || 'S/N';
        if (detalleSubtotal) detalleSubtotal.innerText = `Bs ${parseFloat(factura.subtotal).toFixed(2)}`;
        if (detalleIva) detalleIva.innerText = `Bs ${parseFloat(factura.iva).toFixed(2)}`;
        if (detalleTotal) detalleTotal.innerText = `Bs ${parseFloat(factura.total).toFixed(2)}`;
        
        if (listaItems) {
            listaItems.innerHTML = (factura.items_json || []).map(item => `
                <tr>
                    <td class="text-center">${item.cantidad}x</div>
                    <td>${escapeHtmlFactura(item.producto_nombre)}</div>
                    <td>Bs ${parseFloat(item.precio_unitario).toFixed(2)}</div>
                    <td class="text-primary fw-bold">Bs ${parseFloat(item.subtotal).toFixed(2)}</div>
                </tr>
            `).join('');
        }
        
        window.facturaActual = factura;
        
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleFactura'));
        modal.show();
    };
    
    /**
     * Imprimir factura
     */
    window.imprimirFactura = () => {
        if (!window.facturaActual) return;
        
        const factura = window.facturaActual;
        const ventana = window.open('', '_blank');
        
        ventana.document.write(`
            <html>
            <head>
                <title>Factura ${factura.numero}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .empresa { font-size: 24px; font-weight: bold; }
                    .factura-title { font-size: 18px; margin-top: 10px; }
                    .info { margin: 20px 0; }
                    .info table { width: 100%; }
                    .productos { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .productos th, .productos td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .productos th { background-color: #f2f2f2; }
                    .totales { text-align: right; margin-top: 20px; }
                    .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="empresa">Tienda Abuela Serafina</div>
                    <div class="factura-title">FACTURA DE VENTA</div>
                    <div>N° ${factura.numero}</div>
                </div>
                <div class="info">
                    <table>
                        <tr><td><strong>Fecha:</strong></div><td>${new Date(factura.fecha_emision).toLocaleString()}</div></tr>
                        <tr><td><strong>Cliente:</strong></div><td>${factura.cliente_nombre || 'Consumidor Final'}</div></tr>
                        <tr><td><strong>NIT/CI:</strong></div><td>${factura.cliente_documento || 'S/N'}</div></tr>
                    </table>
                </div>
                <table class="productos">
                    <thead>
                        <tr><th>Cantidad</th><th>Producto</th><th>Precio Unit.</th><th>Subtotal</th></tr>
                    </thead>
                    <tbody>
                        ${(factura.items_json || []).map(item => `
                            <tr>
                                <td>${item.cantidad}x</div>
                                <td>${escapeHtmlFactura(item.producto_nombre)}</div>
                                <td>Bs ${parseFloat(item.precio_unitario).toFixed(2)}</div>
                                <td>Bs ${parseFloat(item.subtotal).toFixed(2)}</div>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="totales">
                    <p><strong>Subtotal:</strong> Bs ${parseFloat(factura.subtotal).toFixed(2)}</p>
                    <p><strong>IVA (13%):</strong> Bs ${parseFloat(factura.iva).toFixed(2)}</p>
                    <p><strong>Total Pagado:</strong> Bs ${parseFloat(factura.total).toFixed(2)}</p>
                </div>
                <div class="footer">
                    <p>¡Gracias por su compra!</p>
                </div>
            </body>
            </html>
        `);
        
        ventana.document.close();
        ventana.print();
    };
    
    /**
     * Exportar facturas a CSV
     */
    window.exportarFacturas = () => {
        if (facturasGlobales.length === 0) {
            window.mostrarNotificacion('No hay facturas para exportar', 'warning');
            return;
        }
        
        const headers = ['N° Factura', 'Fecha', 'Cliente', 'NIT/CI', 'Subtotal', 'IVA', 'Total'];
        const rows = facturasGlobales.map(f => [
            f.numero,
            new Date(f.fecha_emision).toLocaleString(),
            f.cliente_nombre || 'Consumidor Final',
            f.cliente_documento || 'S/N',
            parseFloat(f.subtotal).toFixed(2),
            parseFloat(f.iva).toFixed(2),
            parseFloat(f.total).toFixed(2)
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `facturas_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.mostrarNotificacion('Facturas exportadas correctamente', 'success');
    };
    
    /**
     * Escapar HTML
     */
    function escapeHtmlFactura(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
})(); // Fin del IIFE