// Pagos Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let cuentasCobrarData = [];
    let cuentasPagarData = [];
    let pagosRealizadosData = [];
    let currentPageHistorial = 1;
    let itemsPerPageHistorial = 10;
    
    /**
     * Inicializar módulo de pagos
     */
    window.initPagos = async () => {
        console.log("💳 Iniciando módulo de Pagos...");
        
        await Promise.all([
            cargarCuentasCobrar(),
            cargarCuentasPagar(),
            cargarPagosRealizados()
        ]);
        
        configurarEventosPagos();
    };
    
    /**
     * Configurar eventos
     */
    function configurarEventosPagos() {
        const form = document.getElementById('form-pago');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                mostrarConfirmacionPago();
            };
        }
        
        const btnConfirmar = document.getElementById('btn-confirmar-pago');
        if (btnConfirmar) {
            btnConfirmar.onclick = procesarPago;
        }
        
        const buscarHistorial = document.getElementById('buscar-historial');
        if (buscarHistorial) {
            buscarHistorial.addEventListener('input', () => {
                renderizarHistorial();
            });
        }
    }
    
    /**
     * Actualizar estadísticas del dashboard
     */
    function actualizarEstadisticasPagos() {
        const toNumber = (value) => {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        };
        
        const cuentasCobrarPendientes = cuentasCobrarData.filter(c => c.estado !== 'pagada');
        const totalPorCobrar = cuentasCobrarPendientes.reduce((sum, c) => {
            return sum + (toNumber(c.monto_total) - toNumber(c.monto_pagado));
        }, 0);
        
        const totalCobrado = cuentasCobrarData.reduce((sum, c) => {
            return sum + toNumber(c.monto_pagado);
        }, 0);
        
        const cuentasPagarPendientes = cuentasPagarData.filter(c => c.estado !== 'pagada');
        const totalPorPagar = cuentasPagarPendientes.reduce((sum, c) => {
            return sum + (toNumber(c.monto_total) - toNumber(c.monto_pagado));
        }, 0);
        
        const totalPagado = cuentasPagarData.reduce((sum, c) => {
            return sum + toNumber(c.monto_pagado);
        }, 0);
        
        const totalPorCobrarEl = document.getElementById('total-por-cobrar');
        const totalCobradoEl = document.getElementById('total-cobrado');
        const totalPorPagarEl = document.getElementById('total-por-pagar');
        const totalPagadoEl = document.getElementById('total-pagado');
        
        if (totalPorCobrarEl) totalPorCobrarEl.textContent = `Bs ${totalPorCobrar.toFixed(2)}`;
        if (totalCobradoEl) totalCobradoEl.textContent = `Bs ${totalCobrado.toFixed(2)}`;
        if (totalPorPagarEl) totalPorPagarEl.textContent = `Bs ${totalPorPagar.toFixed(2)}`;
        if (totalPagadoEl) totalPagadoEl.textContent = `Bs ${totalPagado.toFixed(2)}`;
    }
    
    /**
     * Cargar cuentas por cobrar (clientes) - SOLO PENDIENTES
     */
    window.cargarCuentasCobrar = async () => {
        const tbody = document.getElementById('tbody-cuentas-cobrar');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando...</div></td></tr>';

        try {
            const cuentas = await window.api('/pagos/cuentas-por-cobrar');
            
            const todasCuentas = (cuentas || []).map(c => ({
                ...c,
                monto_total: parseFloat(c.monto_total) || 0,
                monto_pagado: parseFloat(c.monto_pagado) || 0
            }));
            
            cuentasCobrarData = todasCuentas.filter(c => c.estado !== 'pagada');
            
            tbody.innerHTML = '';
            
            if (cuentasCobrarData.length === 0) {
                tbody.innerHTML = '<td><td colspan="6" class="text-center py-4 text-muted">No hay cuentas por cobrar pendientes</div></td></tr>';
                actualizarEstadisticasPagos();
                return;
            }
            
            cuentasCobrarData.forEach(c => {
                const saldo = c.monto_total - c.monto_pagado;
                const estadoBadge = '<span class="badge-cobrar"><i class="bi bi-clock"></i> Pendiente</span>';
                
                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold">${escapeHtmlPagos(c.cliente_nombre || 'Consumidor Final')}</div></td>
                        <td>Bs ${c.monto_total.toFixed(2)}</div></td>
                        <td>Bs ${c.monto_pagado.toFixed(2)}</div></td>
                        <td class="fw-bold text-danger">Bs ${saldo.toFixed(2)}</div></td>
                        <td>${estadoBadge}</div></td>
                        <td>
                            <button class="btn btn-sm btn-outline-success btn-icon" 
                                    onclick="prepararPago('venta', '${c.venta_id}', ${saldo})"
                                    title="Cobrar">
                                <i class="bi bi-cash-stack"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            actualizarEstadisticasPagos();
            
        } catch (error) {
            console.error("Error cargando cuentas por cobrar:", error);
            tbody.innerHTML = `<td><td colspan="6" class="text-center text-danger py-4">Error: ${error.message}</div></td></tr>`;
        }
    };
    
    /**
     * Cargar cuentas por pagar (proveedores) - SOLO PENDIENTES
     */
    window.cargarCuentasPagar = async () => {
        const tbody = document.getElementById('tbody-cuentas-pagar');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando...</div></td></tr>';

        try {
            const cuentas = await window.api('/pagos/cuentas-por-pagar');
            
            const todasCuentas = (cuentas || []).map(c => ({
                ...c,
                monto_total: parseFloat(c.monto_total) || 0,
                monto_pagado: parseFloat(c.monto_pagado) || 0
            }));
            
            cuentasPagarData = todasCuentas.filter(c => c.estado !== 'pagada');
            
            tbody.innerHTML = '';
            
            if (cuentasPagarData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay cuentas por pagar pendientes</div></td></tr>';
                actualizarEstadisticasPagos();
                return;
            }
            
            cuentasPagarData.forEach(c => {
                const saldo = c.monto_total - c.monto_pagado;
                const estadoBadge = '<span class="badge-pagar"><i class="bi bi-clock"></i> Pendiente</span>';
                const shortId = c.orden_compra_id?.substring(0, 8) || '-';
                
                tbody.innerHTML += `
                    <tr>
                        <td><code title="${c.orden_compra_id || ''}">${shortId}...</code></div></td>
                        <td>Bs ${c.monto_total.toFixed(2)}</div></td>
                        <td>Bs ${c.monto_pagado.toFixed(2)}</div></td>
                        <td class="fw-bold text-danger">Bs ${saldo.toFixed(2)}</div></td>
                        <td>${estadoBadge}</div></td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger btn-icon" 
                                    onclick="prepararPago('compra', '${c.orden_compra_id}', ${saldo})"
                                    title="Pagar">
                                <i class="bi bi-cash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            actualizarEstadisticasPagos();
            
        } catch (error) {
            console.error("Error cargando cuentas por pagar:", error);
            tbody.innerHTML = `<td><td colspan="6" class="text-center text-danger py-4">Error: ${error.message}</div></td><tr>`;
        }
    };
    
    /**
     * Preparar formulario de pago
     */
    window.prepararPago = (tipo, referenciaId, montoPendiente) => {
        const tipoSelect = document.getElementById('pago-tipo');
        const referenciaInput = document.getElementById('pago-referencia');
        const montoInput = document.getElementById('pago-monto');
        
        if (tipoSelect) tipoSelect.value = tipo;
        if (referenciaInput) referenciaInput.value = referenciaId;
        if (montoInput) montoInput.value = parseFloat(montoPendiente).toFixed(2);
        
        if (montoInput) montoInput.focus();
        
        window.mostrarNotificacion(`Preparado para ${tipo === 'venta' ? 'cobrar' : 'pagar'}`, 'info');
    };
    
    /**
     * Mostrar confirmación de pago
     */
    function mostrarConfirmacionPago() {
        const tipo = document.getElementById('pago-tipo').value;
        const referencia = document.getElementById('pago-referencia').value;
        const monto = document.getElementById('pago-monto').value;
        const metodo = document.getElementById('pago-metodo').value;
        
        if (!referencia) {
            window.mostrarNotificacion('Seleccione una cuenta de las tablas', 'warning');
            return;
        }
        
        if (!monto || parseFloat(monto) <= 0) {
            window.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }
        
        const tipoTexto = tipo === 'venta' ? '📥 Cobro por Venta' : '📤 Pago a Proveedor';
        const metodoTexto = metodo === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia / QR';
        
        document.getElementById('confirm-tipo').textContent = tipoTexto;
        document.getElementById('confirm-referencia').textContent = referencia;
        document.getElementById('confirm-monto').textContent = `Bs ${parseFloat(monto).toFixed(2)}`;
        document.getElementById('confirm-metodo').textContent = metodoTexto;
        
        const modal = new bootstrap.Modal(document.getElementById('modalConfirmarPago'));
        modal.show();
    }
    
    /**
     * Procesar pago
     */
    window.procesarPago = async () => {
        const btn = document.getElementById('btn-procesar');
        const modalElement = document.getElementById('modalConfirmarPago');
        
        const tipo = document.getElementById('pago-tipo').value;
        const referenciaId = document.getElementById('pago-referencia').value;
        const monto = parseFloat(document.getElementById('pago-monto').value);
        const metodo = document.getElementById('pago-metodo').value;
        
        if (!referenciaId) {
            window.mostrarNotificacion('Seleccione una cuenta', 'warning');
            return;
        }
        
        if (!monto || monto <= 0) {
            window.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando...';
        }
        
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
        }
        
        try {
            const payload = {
                tipo: tipo,
                referencia_id: referenciaId,
                monto: monto,
                metodo: metodo
            };
            
            const respuesta = await window.api('/pagos/pagos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            window.mostrarNotificacion(`✅ ${tipo === 'venta' ? 'Cobro' : 'Pago'} registrado con éxito.`, 'success');
            
            document.getElementById('form-pago').reset();
            document.getElementById('pago-referencia').value = '';
            
            await Promise.all([
                cargarCuentasCobrar(),
                cargarCuentasPagar(),
                cargarPagosRealizados()
            ]);
            
        } catch (error) {
            console.error("Error procesando pago:", error);
            window.mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
            
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Procesar Pago';
            }
        }
    };
    
    /**
     * Cargar historial de pagos realizados - SOLO PAGOS COMPLETADOS (sin duplicados)
     */
    window.cargarPagosRealizados = async () => {
        const tbody = document.getElementById('tbody-pagos-realizados');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando historial...</td></tr>';

        try {
            const pagos = await window.api('/pagos');
            
            if (pagos && Array.isArray(pagos) && pagos.length > 0) {
                // 🔥 Eliminar duplicados por id
                const uniqueMap = new Map();
                pagos.forEach(p => {
                    if (!uniqueMap.has(p.id)) {
                        uniqueMap.set(p.id, p);
                    }
                });
                const pagosUnicos = Array.from(uniqueMap.values());
                
                pagosRealizadosData = pagosUnicos.map(p => ({
                    id: p.id,
                    fecha: p.fecha,
                    tipo: p.tipo,
                    referencia_id: p.referencia_id,
                    monto: parseFloat(p.monto),
                    metodo: p.metodo,
                    estado: p.estado
                }));
                
                console.log("📊 Pagos cargados (únicos):", pagosRealizadosData.length);
            } else {
                pagosRealizadosData = [];
            }
            
            pagosRealizadosData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            
            if (pagosRealizadosData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">📭 No hay pagos registrados aún</td></tr>';
                return;
            }
            
            renderizarHistorial();
            
        } catch (error) {
            console.error('Error cargando historial:', error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">❌ Error: ${error.message}</td></tr>`;
        }
    };
    
    /**
     * Renderizar historial de pagos - CORREGIDO (sin duplicación)
     */
    function renderizarHistorial() {
        const tbody = document.getElementById('tbody-pagos-realizados');
        if (!tbody) return;
        
        const searchTerm = document.getElementById('buscar-historial')?.value.toLowerCase() || '';
        let datosFiltrados = [...pagosRealizadosData];
        
        if (searchTerm) {
            datosFiltrados = datosFiltrados.filter(p => {
                const referencia = (p.referencia_id || '').toLowerCase();
                return referencia.includes(searchTerm);
            });
        }
        
        const totalItems = datosFiltrados.length;
        const totalPages = Math.ceil(totalItems / itemsPerPageHistorial);
        const start = (currentPageHistorial - 1) * itemsPerPageHistorial;
        const end = start + itemsPerPageHistorial;
        const datosPagina = datosFiltrados.slice(start, end);
        
        if (datosPagina.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">🔍 No hay pagos que coincidan con la búsqueda</td></tr>';
            renderizarPaginacionHistorial(totalPages);
            return;
        }
        
        // 🔥 CORREGIDO: construcción correcta de filas sin duplicación
        let html = '';
        for (const p of datosPagina) {
            let fecha = 'Fecha no disponible';
            try {
                if (p.fecha) {
                    const fechaObj = new Date(p.fecha);
                    if (!isNaN(fechaObj.getTime())) {
                        fecha = fechaObj.toLocaleString();
                    }
                }
            } catch (e) {
                fecha = p.fecha || 'Fecha no disponible';
            }
            
            const tipoIcono = p.tipo === 'venta' ? '📥' : '📤';
            const tipoTexto = p.tipo === 'venta' ? 'Cobro a Cliente' : 'Pago a Proveedor';
            
            let metodoIcono = '💰';
            let metodoTexto = 'No especificado';
            
            if (p.metodo === 'efectivo') {
                metodoIcono = '💵';
                metodoTexto = 'Efectivo';
            } else if (p.metodo === 'transferencia') {
                metodoIcono = '🏦';
                metodoTexto = 'Transferencia';
            }
            
            const referenciaCorta = p.referencia_id?.substring(0, 12) || 'N/A';
            const monto = parseFloat(p.monto) || 0;
            
            const estadoBadge = '<span class="badge-pagado"><i class="bi bi-check-circle"></i> Completado</span>';
            
            html += `
                <tr>
                    <td><small title="${fecha}">${fecha.substring(0, 16)}...</small></td>
                    <td>${tipoIcono} ${tipoTexto}</td>
                    <td><code title="${p.referencia_id || ''}">${referenciaCorta}</code></td>
                    <td class="fw-bold text-primary">Bs ${monto.toFixed(2)}</td>
                    <td>${metodoIcono} ${metodoTexto}</td>
                    <td>${estadoBadge}</td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html;
        renderizarPaginacionHistorial(totalPages);
    }
    
    /**
     * Renderizar paginación del historial
     */
    function renderizarPaginacionHistorial(totalPages) {
        const container = document.getElementById('paginacion-historial');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let html = `
            <nav>
                <ul class="pagination">
                    <li class="page-item ${currentPageHistorial === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaHistorial(${currentPageHistorial - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </li>
        `;
        
        let startPage = Math.max(1, currentPageHistorial - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${currentPageHistorial === i ? 'active' : ''}">
                    <button class="page-link" onclick="cambiarPaginaHistorial(${i})">${i}</button>
                </li>
            `;
        }
        
        html += `
                    <li class="page-item ${currentPageHistorial === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaHistorial(${currentPageHistorial + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </li>
                </ul>
            </nav>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * Cambiar página del historial
     */
    window.cambiarPaginaHistorial = function(page) {
        currentPageHistorial = page;
        renderizarHistorial();
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };
    
    /**
     * Escapar HTML
     */
    function escapeHtmlPagos(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
})(); // Fin del IIFE