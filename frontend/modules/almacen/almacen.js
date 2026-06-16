// Almacén Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let companiesTransfer = [];
    let modalTransferencia = null;
    let stockDataAlmacen = [];
    let productosMapAlmacen = new Map();
    let agenciasMapAlmacen = new Map();
    let movimientosAlmacen = [];
    let currentPageAlmacen = 1;
    let itemsPerPageAlmacen = 10;
    let currentFiltersAlmacen = {
        search: '',
        stockBajo: 'todos',
        agencia: 'todas'
    };
    
    /**
     * Inicializar módulo de almacén
     */
    window.initAlmacen = async function() {
        console.log('📦 Inicializando módulo de almacén...');
        
        mostrarLoadingAlmacen();
        
        await Promise.all([
            cargarCatalogosAlmacen(),
            cargarStockAlmacen(),
            cargarMovimientosRecientesAlmacen(),
            cargarCompaniesTransfer(),
        ]);
        
        configurarEventosAlmacen();
        actualizarEstadisticasAlmacen();
    };
    
    /**
     * Mostrar loading en tabla
     */
    function mostrarLoadingAlmacen() {
        const tbody = document.getElementById('almacen-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="mt-2 text-muted">Cargando inventario...</p>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Convertir número de forma segura
     */
    function toNumberAlmacen(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    }
    
    /**
     * Formatear precio
     */
    function formatPriceAlmacen(price) {
        const num = toNumberAlmacen(price);
        return num.toFixed(2);
    }
    
    /**
     * Cargar catálogos de productos y agencias
     */
    async function cargarCatalogosAlmacen() {
        try {
            const [productos, agencias] = await Promise.all([
                window.apiWithRetry('/products', {}, 2),
                window.apiWithRetry('/inventory/agencias', {}, 2)
            ]);
            
            if (productos && Array.isArray(productos)) {
                productosMapAlmacen.clear();
                productos.forEach(p => {
                    productosMapAlmacen.set(p.id, {
                        nombre: p.nombre,
                        precio: toNumberAlmacen(p.precio_base),
                        categoria: p.categoria
                    });
                });
                
                const sProducto = document.getElementById('producto_id');
                if (sProducto) {
                    sProducto.innerHTML = '<option value="">Seleccionar producto...</option>' + 
                        productos.map(p => `<option value="${p.id}">${escapeHtmlAlmacen(p.nombre)} - Bs ${toNumberAlmacen(p.precio_base).toFixed(2)}</option>`).join('');
                }
            }
            
            if (agencias && Array.isArray(agencias)) {
                agenciasMapAlmacen.clear();
                agencias.forEach(a => {
                    agenciasMapAlmacen.set(a.id, {
                        nombre: a.nombre,
                        ubicacion: a.ubicacion
                    });
                });
                
                const sAgencia = document.getElementById('agencia_id');
                const filterAgencia = document.getElementById('filter-agencia');
                
                if (sAgencia) {
                    sAgencia.innerHTML = '<option value="">Seleccionar agencia...</option>' + 
                        agencias.map(a => `<option value="${a.id}">${escapeHtmlAlmacen(a.nombre)} - ${a.ubicacion || 'Sin ubicación'}</option>`).join('');
                }
                
                if (filterAgencia) {
                    filterAgencia.innerHTML = '<option value="todas">📊 Todas las agencias</option>' +
                        agencias.map(a => `<option value="${a.id}">🏢 ${escapeHtmlAlmacen(a.nombre)}</option>`).join('');
                }
            }
            
        } catch (error) {
            console.error('Error cargando catálogos:', error);
            window.mostrarNotificacion('Error cargando catálogos: ' + error.message, 'error');
        }
    }
    
    /**
     * Cargar stock desde API
     */
    async function cargarStockAlmacen() {
        try {
            const data = await window.apiWithRetry('/inventory/stock', {}, 2);
            
            if (data && Array.isArray(data)) {
                stockDataAlmacen = data;
                renderizarStockAlmacen();
                actualizarEstadisticasAlmacen();
            } else {
                throw new Error('Datos de stock inválidos');
            }
            
        } catch (error) {
            console.error('Error cargando stock:', error);
            window.mostrarNotificacion('Error cargando stock: ' + error.message, 'error');
            
            const tbody = document.getElementById('almacen-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-5 text-danger">
                            <i class="bi bi-exclamation-triangle-fill" style="font-size: 3rem;"></i>
                            <p class="mt-2">Error al cargar el inventario</p>
                            <button class="btn btn-primary mt-2" onclick="window.initAlmacen()">
                                <i class="bi bi-arrow-repeat"></i> Reintentar
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Renderizar tabla de stock con filtros y paginación
     */
    function renderizarStockAlmacen() {
        const tbody = document.getElementById('almacen-body');
        if (!tbody) return;
        
        let datosFiltrados = [...stockDataAlmacen];
        
        if (currentFiltersAlmacen.search) {
            const searchTerm = currentFiltersAlmacen.search.toLowerCase();
            datosFiltrados = datosFiltrados.filter(item => {
                const producto = productosMapAlmacen.get(item.producto_id);
                return producto && producto.nombre.toLowerCase().includes(searchTerm);
            });
        }
        
        if (currentFiltersAlmacen.stockBajo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(item => {
                if (currentFiltersAlmacen.stockBajo === 'bajo') return item.cantidad <= 10 && item.cantidad > 0;
                if (currentFiltersAlmacen.stockBajo === 'critico') return item.cantidad <= 5 && item.cantidad > 0;
                if (currentFiltersAlmacen.stockBajo === 'agotado') return item.cantidad === 0;
                return true;
            });
        }
        
        if (currentFiltersAlmacen.agencia !== 'todas') {
            datosFiltrados = datosFiltrados.filter(item => 
                item.agencia_id === currentFiltersAlmacen.agencia
            );
        }
        
        const totalItems = datosFiltrados.length;
        const totalPages = Math.ceil(totalItems / itemsPerPageAlmacen);
        const start = (currentPageAlmacen - 1) * itemsPerPageAlmacen;
        const end = start + itemsPerPageAlmacen;
        const datosPagina = datosFiltrados.slice(start, end);
        
        if (datosPagina.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                        <p class="mt-2">No hay productos que coincidan con los filtros</p>
                    </div>
                </div>
            `;
            renderizarPaginacionAlmacen(totalPages);
            return;
        }
        
        tbody.innerHTML = datosPagina.map(item => {
            const producto = productosMapAlmacen.get(item.producto_id);
            const agencia = agenciasMapAlmacen.get(item.agencia_id);
            const nombreProducto = producto?.nombre || 'Producto no encontrado';
            const nombreAgencia = agencia?.nombre || 'Agencia no encontrada';
            
            let estadoBadge = '';
            let estadoColor = '';
            if (item.cantidad === 0) {
                estadoBadge = '<span class="badge bg-danger">Agotado</span>';
                estadoColor = 'table-danger';
            } else if (item.cantidad <= 5) {
                estadoBadge = '<span class="badge bg-warning text-dark">Stock Crítico</span>';
                estadoColor = 'table-warning';
            } else if (item.cantidad <= 10) {
                estadoBadge = '<span class="badge bg-info">Stock Bajo</span>';
                estadoColor = 'table-info';
            } else {
                estadoBadge = '<span class="badge bg-success">Normal</span>';
            }
            
            return `
                <tr class="${estadoColor}">
                    <td class="fw-bold">${escapeHtmlAlmacen(nombreProducto)}</div>
                    <td>${escapeHtmlAlmacen(nombreAgencia)}</div>
                    <td><span class="badge bg-primary fs-6">${item.cantidad} unidades</span></div>
                    <td>${estadoBadge}</div>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="abrirModalAjusteAlmacen('${item.producto_id}', '${item.agencia_id}', '${escapeHtmlAlmacen(nombreProducto)}', ${item.cantidad})">
                            <i class="bi bi-pencil-square"></i> Ajustar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        renderizarPaginacionAlmacen(totalPages);
    }
    
    /**
     * Renderizar paginación
     */
    function renderizarPaginacionAlmacen(totalPages) {
        const container = document.getElementById('pagination-container');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let html = `
            <nav>
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentPageAlmacen === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaStockAlmacen(${currentPageAlmacen - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </li>
        `;
        
        let startPage = Math.max(1, currentPageAlmacen - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${currentPageAlmacen === i ? 'active' : ''}">
                    <button class="page-link" onclick="cambiarPaginaStockAlmacen(${i})">${i}</button>
                </li>
            `;
        }
        
        html += `
                    <li class="page-item ${currentPageAlmacen === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaStockAlmacen(${currentPageAlmacen + 1})">
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
    window.cambiarPaginaStockAlmacen = function(page) {
        currentPageAlmacen = page;
        renderizarStockAlmacen();
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };
    
    /**
     * Actualizar estadísticas del dashboard
     */
    function actualizarEstadisticasAlmacen() {
        const totalProductos = new Set(stockDataAlmacen.map(s => s.producto_id)).size;
        const totalUnidades = stockDataAlmacen.reduce((sum, item) => sum + item.cantidad, 0);
        const stockBajo = stockDataAlmacen.filter(item => item.cantidad <= 10 && item.cantidad > 0).length;
        
        const totalProductosEl = document.getElementById('total-productos');
        const totalUnidadesEl = document.getElementById('total-unidades');
        const stockBajoEl = document.getElementById('stock-bajo');
        const movimientosHoyEl = document.getElementById('movimientos-hoy');
        
        if (totalProductosEl) totalProductosEl.textContent = totalProductos;
        if (totalUnidadesEl) totalUnidadesEl.textContent = totalUnidades;
        if (stockBajoEl) stockBajoEl.textContent = stockBajo;
        if (movimientosHoyEl) movimientosHoyEl.textContent = movimientosAlmacen.length || '--';
    }
    
    /**
     * Cargar movimientos recientes
     */
    async function cargarMovimientosRecientesAlmacen() {
        try {
            const data = await window.apiWithRetry('/inventory/movimientos?limit=50', {}, 2);
            
            if (data && Array.isArray(data)) {
                movimientosAlmacen = data;
                renderizarMovimientosRecientesAlmacen();
            } else {
                mostrarMovimientosEjemploAlmacen();
            }
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            mostrarMovimientosEjemploAlmacen();
        }
    }
    
    /**
     * Renderizar movimientos recientes
     */
    function renderizarMovimientosRecientesAlmacen() {
        const tbody = document.getElementById('movimientos-recientes-body');
        if (!tbody) return;
        
        const movimientosRecientes = movimientosAlmacen.slice(0, 5);
        
        if (movimientosRecientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay movimientos registrados</div></td>';
            return;
        }
        
        tbody.innerHTML = movimientosRecientes.map(mov => {
            const producto = productosMapAlmacen.get(mov.producto_id);
            const agencia = agenciasMapAlmacen.get(mov.agencia_id);
            
            let tipoIcono = '';
            let tipoColor = '';
            let tipoTexto = '';
            
            switch (mov.tipo) {
                case 'entrada':
                    tipoIcono = '📥';
                    tipoColor = 'text-success';
                    tipoTexto = 'Entrada';
                    break;
                case 'salida':
                    tipoIcono = '📤';
                    tipoColor = 'text-danger';
                    tipoTexto = 'Salida';
                    break;
                case 'devolucion_cliente':
                    tipoIcono = '🔄';
                    tipoColor = 'text-info';
                    tipoTexto = 'Dev. Cliente';
                    break;
                case 'devolucion_proveedor':
                    tipoIcono = '⬅️';
                    tipoColor = 'text-warning';
                    tipoTexto = 'Dev. Proveedor';
                    break;
                default:
                    tipoIcono = '📊';
                    tipoColor = 'text-secondary';
                    tipoTexto = mov.tipo;
            }
            
            const fecha = new Date(mov.fecha || mov.created_at || Date.now()).toLocaleString('es-ES');
            
            return `
                <tr>
                    <td><small>${fecha}</small></div>
                    <td><span class="${tipoColor}">${tipoIcono} ${tipoTexto}</span></div>
                    <td>${escapeHtmlAlmacen(producto?.nombre || mov.producto_id)}</div>
                    <td>${escapeHtmlAlmacen(agencia?.nombre || mov.agencia_id)}</div>
                    <td class="fw-bold">${mov.cantidad}</div>
                    <td><small class="text-muted">${mov.motivo || '-'}</small></div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Mostrar movimientos de ejemplo
     */
    function mostrarMovimientosEjemploAlmacen() {
        movimientosAlmacen = [
            {
                id: 1,
                fecha: new Date().toISOString(),
                tipo: 'entrada',
                producto_id: Array.from(productosMapAlmacen.keys())[0] || '1',
                agencia_id: Array.from(agenciasMapAlmacen.keys())[0] || '1',
                cantidad: 50,
                motivo: 'Compra a proveedor'
            },
            {
                id: 2,
                fecha: new Date(Date.now() - 86400000).toISOString(),
                tipo: 'salida',
                producto_id: Array.from(productosMapAlmacen.keys())[1] || '2',
                agencia_id: Array.from(agenciasMapAlmacen.keys())[0] || '1',
                cantidad: 5,
                motivo: 'Venta a cliente'
            }
        ];
        renderizarMovimientosRecientesAlmacen();
    }
    
    /**
     * Registrar movimiento de stock
     */
    async function registrarMovimientoAlmacen(event) {
        event.preventDefault();
        
        const tipo = document.getElementById('tipo').value;
        const agenciaId = document.getElementById('agencia_id').value;
        const productoId = document.getElementById('producto_id').value;
        const cantidad = parseInt(document.getElementById('cantidad').value);
        
        if (!agenciaId || !productoId || !cantidad) {
            window.mostrarNotificacion('Por favor complete todos los campos', 'warning');
            return;
        }
        
        if (isNaN(cantidad) || cantidad <= 0) {
            window.mostrarNotificacion('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        const esSalida = tipo === 'salida' || tipo === 'devolucion_proveedor';
        let stockActual = null;
        
        if (esSalida) {
            stockActual = stockDataAlmacen.find(s => s.producto_id === productoId && s.agencia_id === agenciaId);
            if (!stockActual || stockActual.cantidad < cantidad) {
                window.mostrarNotificacion('Stock insuficiente para esta operación', 'error');
                return;
            }
        }
        
        const cantidadAntes = stockActual?.cantidad || 0;
        let cantidadDespues = cantidadAntes;
        
        if (tipo === 'entrada' || tipo === 'devolucion_cliente') {
            cantidadDespues = cantidadAntes + cantidad;
        } else if (tipo === 'salida' || tipo === 'devolucion_proveedor') {
            cantidadDespues = cantidadAntes - cantidad;
        }
        
        let textoConfirmacion = '';
        let iconoConfirmacion = 'question';
        
        switch(tipo) {
            case 'entrada':
                textoConfirmacion = `📥 ¿Registrar entrada de ${cantidad} unidades? (Stock: ${cantidadAntes} → ${cantidadDespues})`;
                break;
            case 'salida':
                textoConfirmacion = `📤 ¿Registrar salida de ${cantidad} unidades? (Stock: ${cantidadAntes} → ${cantidadDespues})`;
                break;
            case 'devolucion_cliente':
                textoConfirmacion = `🔄 ¿Registrar devolución de cliente de ${cantidad} unidades? (Stock: ${cantidadAntes} → ${cantidadDespues})`;
                iconoConfirmacion = 'info';
                break;
            case 'devolucion_proveedor':
                textoConfirmacion = `⬅️ ¿Registrar devolución a proveedor de ${cantidad} unidades? (Stock: ${cantidadAntes} → ${cantidadDespues})`;
                iconoConfirmacion = 'warning';
                break;
        }
        
        const confirmacion = await Swal.fire({
            title: 'Confirmar movimiento',
            text: textoConfirmacion,
            icon: iconoConfirmacion,
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmacion.isConfirmed) return;
        
        let motivo = '';
        if (tipo.includes('devolucion')) {
            const { value: motivoInput } = await Swal.fire({
                title: 'Motivo de la devolución',
                input: 'select',
                inputOptions: {
                    'producto_defectuoso': 'Producto defectuoso',
                    'producto_equivocado': 'Producto equivocado',
                    'cliente_arrepentimiento': 'Arrepentimiento del cliente',
                    'daño_transporte': 'Daño en transporte',
                    'otro': 'Otro motivo'
                },
                inputPlaceholder: 'Seleccione un motivo',
                showCancelButton: true,
                confirmButtonText: 'Registrar',
                cancelButtonText: 'Cancelar'
            });
            
            if (!motivoInput) return;
            motivo = motivoInput;
        }
        
        const payload = {
            tipo: tipo,
            agencia_id: agenciaId,
            producto_id: productoId,
            cantidad: cantidad,
            cantidad_antes: cantidadAntes,
            cantidad_despues: cantidadDespues,
            motivo: motivo || (tipo === 'entrada' ? 'Compra' : tipo === 'salida' ? 'Venta' : 'Ajuste')
        };
        
        console.log('📦 Enviando movimiento:', payload);
        
        try {
            const response = await api('/inventory/movimientos', { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            
            console.log('✅ Movimiento registrado:', response);
            
            document.getElementById('form-movimiento').reset();
            
            await Promise.all([
                cargarStockAlmacen(),
                cargarMovimientosRecientesAlmacen()
            ]);
        
            window.mostrarNotificacion(`Movimiento registrado exitosamente`, 'success');
            
        } catch (error) {
            console.error('Error registrando movimiento:', error);
            window.mostrarNotificacion(`Error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Abrir modal para ajustar stock
     */
    window.abrirModalAjusteAlmacen = function(productoId, agenciaId, productoNombre, stockActual) {
        document.getElementById('ajuste-producto-id').value = productoId;
        document.getElementById('ajuste-agencia-id').value = agenciaId;
        document.getElementById('ajuste-producto-nombre').textContent = productoNombre;
        document.getElementById('ajuste-stock-actual').textContent = `${stockActual} unidades`;
        document.getElementById('ajuste-cantidad').value = '';
        document.getElementById('ajuste-motivo').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalAjusteStock'));
        modal.show();
    };
    
    /**
     * Confirmar ajuste de stock
     */
    async function confirmarAjusteStockAlmacen() {
        const productoId = document.getElementById('ajuste-producto-id').value;
        const agenciaId = document.getElementById('ajuste-agencia-id').value;
        const tipo = document.getElementById('ajuste-tipo').value;
        const cantidad = parseInt(document.getElementById('ajuste-cantidad').value);
        const motivo = document.getElementById('ajuste-motivo').value;
        
        if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
            window.mostrarNotificacion('Ingrese una cantidad válida', 'warning');
            return;
        }
        
        if (tipo === 'salida') {
            const stockActual = stockDataAlmacen.find(s => s.producto_id === productoId && s.agencia_id === agenciaId);
            if (!stockActual || stockActual.cantidad < cantidad) {
                window.mostrarNotificacion('Stock insuficiente para esta salida', 'error');
                return;
            }
        }
        
        try {
            const payload = {
                tipo: tipo,
                agencia_id: agenciaId,
                producto_id: productoId,
                cantidad: cantidad,
                motivo: motivo || 'Ajuste manual'
            };
            
            await api('/inventory/movimientos', { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            
            bootstrap.Modal.getInstance(document.getElementById('modalAjusteStock')).hide();
            
            await Promise.all([
                cargarStockAlmacen(),
                cargarMovimientosRecientesAlmacen()
            ]);
            
            window.mostrarNotificacion(`Stock ajustado correctamente`, 'success');
            
        } catch (error) {
            console.error('Error ajustando stock:', error);
            window.mostrarNotificacion(`Error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Mostrar todos los movimientos en el modal
     */
    window.mostrarTodosMovimientosAlmacen = async function() {
        const tbody = document.getElementById('todos-movimientos-body');
        if (!tbody) return;
        
        tbody.innerHTML = '<td><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm"></div> Cargando...</div></div>';

        try {
            const data = await window.apiWithRetry('/inventory/movimientos?limit=200', {}, 2);
            
            if (data && Array.isArray(data)) {
                window.todosMovimientosAlmacen = data;
                renderizarTodosMovimientosAlmacen(data);
            }
            
            const searchInput = document.getElementById('search-movimientos');
            if (searchInput) {
                searchInput.oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    const filtrados = window.todosMovimientosAlmacen.filter(mov => {
                        const producto = productosMapAlmacen.get(mov.producto_id);
                        return producto?.nombre.toLowerCase().includes(term);
                    });
                    renderizarTodosMovimientosAlmacen(filtrados);
                };
            }
            
        } catch (error) {
            console.error('Error cargando todos los movimientos:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando movimientos</div></td>';
        }
    };
    
    /**
     * Renderizar todos los movimientos
     */
    function renderizarTodosMovimientosAlmacen(movimientosData) {
        const tbody = document.getElementById('todos-movimientos-body');
        if (!tbody) return;
        
        if (movimientosData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay movimientos registrados</div></td>';
            return;
        }
        
        tbody.innerHTML = movimientosData.map(mov => {
            const producto = productosMapAlmacen.get(mov.producto_id);
            const agencia = agenciasMapAlmacen.get(mov.agencia_id);
            
            let tipoIcono = '';
            let tipoTexto = '';
            switch (mov.tipo) {
                case 'entrada':
                    tipoIcono = '📥';
                    tipoTexto = 'Entrada';
                    break;
                case 'salida':
                    tipoIcono = '📤';
                    tipoTexto = 'Salida';
                    break;
                case 'devolucion_cliente':
                    tipoIcono = '🔄';
                    tipoTexto = 'Dev. Cliente';
                    break;
                case 'devolucion_proveedor':
                    tipoIcono = '⬅️';
                    tipoTexto = 'Dev. Proveedor';
                    break;
                default:
                    tipoIcono = '📊';
                    tipoTexto = mov.tipo;
            }
            
            const fecha = new Date(mov.fecha || mov.created_at || Date.now()).toLocaleString('es-ES');
            
            return `
                <tr>
                    <td><small>${fecha}</small></div>
                    <td>${tipoIcono} ${tipoTexto}</div>
                    <td>${escapeHtmlAlmacen(producto?.nombre || mov.producto_id)}</div>
                    <td>${escapeHtmlAlmacen(agencia?.nombre || mov.agencia_id)}</div>
                    <td class="fw-bold">${mov.cantidad}</div>
                    <td><small>${mov.motivo || '-'}</small></div>
                </div>
            `;
        }).join('');
    }
    
    // ── Transferencia entre sucursales ────────────────────────────────────────

    async function cargarCompaniesTransfer() {
        try {
            companiesTransfer = await window.api('/companies');
            const sel = document.getElementById('transfer-company');
            if (!sel) return;
            sel.innerHTML = '<option value="">Seleccionar supermercado...</option>' +
                companiesTransfer.map(c => `<option value="${c.id}">${escapeHtmlAlmacen(c.nombre)}</option>`).join('');
        } catch (e) {
            console.error('Error cargando companies para transfer:', e);
        }
    }

    function poblarSucursalesTransfer(companyId) {
        const selOrigen  = document.getElementById('transfer-origen');
        const selDestino = document.getElementById('transfer-destino');
        const company = companiesTransfer.find(c => c.id === companyId);
        const branches = company?.branches || [];

        if (!branches.length) {
            selOrigen.innerHTML  = '<option value="">Sin sucursales</option>';
            selDestino.innerHTML = '<option value="">Sin sucursales</option>';
            selOrigen.disabled   = true;
            selDestino.disabled  = true;
            return;
        }

        const opts = '<option value="">Seleccionar...</option>' +
            branches.map(b => `<option value="${b.id}">${escapeHtmlAlmacen(b.nombre)}</option>`).join('');
        selOrigen.innerHTML  = opts;
        selDestino.innerHTML = opts;
        selOrigen.disabled   = false;
        selDestino.disabled  = false;
        actualizarStockInfoTransfer();
    }

    function actualizarStockInfoTransfer() {
        const origenId   = document.getElementById('transfer-origen')?.value;
        const productoId = document.getElementById('transfer-producto')?.value;
        const infoEl     = document.getElementById('transfer-stock-info');
        const stockEl    = document.getElementById('transfer-stock-actual');
        if (!infoEl || !stockEl) return;

        if (origenId && productoId) {
            const entry = stockDataAlmacen.find(
                s => s.agencia_id === origenId && s.producto_id === productoId
            );
            stockEl.textContent = entry ? entry.cantidad : '0';
            infoEl.classList.remove('d-none');
        } else {
            infoEl.classList.add('d-none');
        }
    }

    async function ejecutarTransferencia() {
        const companyId  = document.getElementById('transfer-company').value;
        const origenId   = document.getElementById('transfer-origen').value;
        const destinoId  = document.getElementById('transfer-destino').value;
        const productoId = document.getElementById('transfer-producto').value;
        const cantidad   = parseInt(document.getElementById('transfer-cantidad').value, 10);

        if (!companyId || !origenId || !destinoId || !productoId || !cantidad) {
            window.mostrarNotificacion('Complete todos los campos', 'warning');
            return;
        }
        if (origenId === destinoId) {
            window.mostrarNotificacion('Origen y destino no pueden ser la misma sucursal', 'warning');
            return;
        }
        if (isNaN(cantidad) || cantidad <= 0) {
            window.mostrarNotificacion('La cantidad debe ser mayor a 0', 'warning');
            return;
        }

        const stockEntry = stockDataAlmacen.find(
            s => s.agencia_id === origenId && s.producto_id === productoId
        );
        if (!stockEntry || stockEntry.cantidad < cantidad) {
            window.mostrarNotificacion('Stock insuficiente en la sucursal origen', 'error');
            return;
        }

        const origenNombre  = document.getElementById('transfer-origen').selectedOptions[0].text;
        const destinoNombre = document.getElementById('transfer-destino').selectedOptions[0].text;
        const productoNombre = document.getElementById('transfer-producto').selectedOptions[0].text;

        const confirm = await Swal.fire({
            title: '¿Confirmar transferencia?',
            html: `
                <div style="text-align:left;font-size:0.9rem">
                    <p><b>Producto:</b> ${escapeHtmlAlmacen(productoNombre)}</p>
                    <p><b>Cantidad:</b> ${cantidad} unidades</p>
                    <p><b>Origen:</b> ${escapeHtmlAlmacen(origenNombre)}</p>
                    <p><b>Destino:</b> ${escapeHtmlAlmacen(destinoNombre)}</p>
                </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, transferir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2a9d8f',
        });
        if (!confirm.isConfirmed) return;

        const btn = document.getElementById('btn-confirmar-transferencia');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Transfiriendo...';

        try {
            await window.api('/inventory/transfer', {
                method: 'POST',
                body: JSON.stringify({
                    sucursal_origen_id:  origenId,
                    sucursal_destino_id: destinoId,
                    producto_id:         productoId,
                    cantidad,
                }),
            });

            bootstrap.Modal.getInstance(document.getElementById('modalTransferencia'))?.hide();
            window.mostrarNotificacion(`Transferencia completada: ${cantidad} unidades de "${productoNombre}" enviadas a ${escapeHtmlAlmacen(destinoNombre)}`, 'success');

            await Promise.all([cargarStockAlmacen(), cargarMovimientosRecientesAlmacen()]);
        } catch (e) {
            window.mostrarNotificacion('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Transferir';
        }
    }

    /**
     * Configurar eventos del DOM
     */
    function configurarEventosAlmacen() {
        const form = document.getElementById('form-movimiento');
        if (form) {
            form.onsubmit = registrarMovimientoAlmacen;
        }
        
        const refreshBtn = document.getElementById('refresh-stock');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                cargarStockAlmacen();
                cargarMovimientosRecientesAlmacen();
            };
        }
        
        const searchInput = document.getElementById('search-stock');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentFiltersAlmacen.search = e.target.value;
                currentPageAlmacen = 1;
                renderizarStockAlmacen();
            });
        }
        
        const filterStock = document.getElementById('filter-stock-bajo');
        if (filterStock) {
            filterStock.addEventListener('change', (e) => {
                currentFiltersAlmacen.stockBajo = e.target.value;
                currentPageAlmacen = 1;
                renderizarStockAlmacen();
            });
        }
        
        const filterAgencia = document.getElementById('filter-agencia');
        if (filterAgencia) {
            filterAgencia.addEventListener('change', (e) => {
                currentFiltersAlmacen.agencia = e.target.value;
                currentPageAlmacen = 1;
                renderizarStockAlmacen();
            });
        }
        
        const clearFilters = document.getElementById('clear-filters');
        if (clearFilters) {
            clearFilters.onclick = () => {
                currentFiltersAlmacen = { search: '', stockBajo: 'todos', agencia: 'todas' };
                currentPageAlmacen = 1;
                
                if (searchInput) searchInput.value = '';
                if (filterStock) filterStock.value = 'todos';
                if (filterAgencia) filterAgencia.value = 'todas';
                
                renderizarStockAlmacen();
                window.mostrarNotificacion('Filtros limpiados', 'info');
            };
        }
        
        const confirmBtn = document.getElementById('btn-confirmar-ajuste');
        if (confirmBtn) {
            confirmBtn.onclick = confirmarAjusteStockAlmacen;
        }
        
        const verTodosBtn = document.getElementById('ver-todos-movimientos');
        if (verTodosBtn) {
            verTodosBtn.onclick = () => {
                window.mostrarTodosMovimientosAlmacen();
                const modal = new bootstrap.Modal(document.getElementById('modalTodosMovimientos'));
                modal.show();
            };
        }

        // ── Transferencia ────────────────────────────────────────────────────
        document.getElementById('btn-abrir-transferencia')?.addEventListener('click', () => {
            // Poblar productos en el modal
            const selProducto = document.getElementById('transfer-producto');
            if (selProducto) {
                selProducto.innerHTML = '<option value="">Seleccionar producto...</option>' +
                    Array.from(productosMapAlmacen.entries()).map(([id, p]) =>
                        `<option value="${id}">${escapeHtmlAlmacen(p.nombre)}</option>`
                    ).join('');
            }
            // Limpiar estado previo
            document.getElementById('transfer-company').value = '';
            document.getElementById('transfer-origen').innerHTML  = '<option value="">Seleccionar...</option>';
            document.getElementById('transfer-destino').innerHTML = '<option value="">Seleccionar...</option>';
            document.getElementById('transfer-origen').disabled   = true;
            document.getElementById('transfer-destino').disabled  = true;
            document.getElementById('transfer-cantidad').value    = '';
            document.getElementById('transfer-stock-info')?.classList.add('d-none');

            modalTransferencia = new bootstrap.Modal(document.getElementById('modalTransferencia'));
            modalTransferencia.show();
        });

        document.getElementById('transfer-company')?.addEventListener('change', e => {
            poblarSucursalesTransfer(e.target.value);
        });

        document.getElementById('transfer-origen')?.addEventListener('change', actualizarStockInfoTransfer);
        document.getElementById('transfer-producto')?.addEventListener('change', actualizarStockInfoTransfer);

        document.getElementById('btn-confirmar-transferencia')?.addEventListener('click', ejecutarTransferencia);
    }
    
    /**
     * Escapar HTML para evitar XSS
     */
    function escapeHtmlAlmacen(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
})(); // Fin del IIFE