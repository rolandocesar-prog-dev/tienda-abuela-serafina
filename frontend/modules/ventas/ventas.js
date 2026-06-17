// Ventas Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let carritoVentas = [];
    let productosVentas = [];
    let stockVentas = {};
    let agenciasVentas = [];
    let currentSearchTerm = '';
    
    // Función principal de inicialización
    window.initVentas = async function() {
        console.log("🛒 Iniciando módulo de Ventas...");

        mostrarLoading();

        // Agencias primero: el Vendedor necesita su sucursal pre-seleccionada
        // antes de que renderizarProductos filtre el stock por agencia_id
        await cargarAgencias();
        await Promise.all([cargarProductos(), cargarEstadisticas()]);

        configurarEventos();
    };
    
    /**
     * Mostrar loading
     */
    function mostrarLoading() {
        const container = document.getElementById('productos-container');
        if (container) {
            container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Cargando productos...</p></div>';
        }
    }
    
    /**
     * Cargar agencias/sucursales.
     * Si el usuario es Vendedor, pre-selecciona su sucursal y bloquea el selector.
     */
    async function cargarAgencias() {
        try {
            agenciasVentas = await window.api('/inventory/agencias');
            const select = document.getElementById('agencia_id');
            if (!select) return;

            const user = window.currentUser;
            const esVendedor = user?.rol === 'Vendedor';
            const sucursalId = user?.sucursal_id;

            if (esVendedor && sucursalId) {
                // Mostrar solo la sucursal del vendedor
                const suSucursal = agenciasVentas.find(a => a.id === sucursalId);
                if (suSucursal) {
                    select.innerHTML = `<option value="${suSucursal.id}">${escapeHtmlVentas(suSucursal.nombre)}</option>`;
                    select.value = suSucursal.id;
                    select.disabled = true;
                } else {
                    select.innerHTML = '<option value="">Sucursal no encontrada</option>';
                    window.mostrarNotificacion('Tu sucursal asignada no está disponible', 'error');
                }
            } else {
                // Admin: ver todas
                select.innerHTML = '<option value="">Seleccionar sucursal...</option>' +
                    agenciasVentas.map(a => `<option value="${a.id}">${escapeHtmlVentas(a.nombre)}</option>`).join('');
                select.disabled = false;
            }
        } catch (error) {
            console.error("Error cargando agencias:", error);
            window.mostrarNotificacion('Error cargando sucursales: ' + error.message, 'error');
        }
    }
    
    /**
     * Cargar productos y stock (separado por agencia)
     */
    async function cargarProductos() {
        try {
            const [productos, stock] = await Promise.all([
                window.api('/products'),
                window.api('/inventory/stock')
            ]);
            
            productosVentas = productos || [];
            
            if (stock && Array.isArray(stock)) {
                stockVentas = {};
                stock.forEach(item => {
                    const key = `${item.producto_id}_${item.agencia_id}`;
                    stockVentas[key] = item.cantidad;
                });
                console.log("📊 Stock cargado por agencia:", stockVentas);
            } else {
                stockVentas = {};
            }
            
            renderizarProductos();
            
        } catch (error) {
            console.error("Error cargando productos:", error);
            window.mostrarNotificacion('Error cargando productos: ' + error.message, 'error');
        }
    }
    
    /**
     * Renderizar productos en grid
     */
    function renderizarProductos() {
        const container = document.getElementById('productos-container');
        const agenciaId = document.getElementById('agencia_id')?.value;
        
        if (!container) return;
        
        const getStockForAgencia = (productoId) => {
            if (!agenciaId) return 0;
            const key = `${productoId}_${agenciaId}`;
            return stockVentas[key] || 0;
        };
        
        const productosFiltrados = currentSearchTerm
            ? productosVentas.filter(p => p.nombre && p.nombre.toLowerCase().includes(currentSearchTerm))
            : productosVentas;
        
        if (productosFiltrados.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-muted">No hay productos disponibles</div>';
            return;
        }
        
        if (!agenciaId) {
            container.innerHTML = '<div class="text-center py-4 text-warning">⚠️ Seleccione una sucursal para ver el stock disponible</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="productos-grid">
                ${productosFiltrados.map(p => {
                    const precio = parseFloat(p.precio_base) || 0;
                    const stockReal = getStockForAgencia(p.id);
                    const stockClass = stockReal <= 5 ? 'bajo' : '';
                    const stockText = stockReal <= 0 ? '❌ Agotado' : stockReal <= 5 ? `⚠️ Stock: ${stockReal}` : `📦 Stock: ${stockReal}`;
                    const disabled = stockReal <= 0 ? 'disabled' : '';
                    
                    return `
                        <div class="producto-card" data-id="${p.id}" data-nombre="${escapeHtmlVentas(p.nombre)}" data-precio="${precio}" data-stock="${stockReal}" ${disabled}>
                            <div class="producto-nombre">${escapeHtmlVentas(p.nombre)}</div>
                            <div class="producto-precio">Bs ${precio.toFixed(2)}</div>
                            <div class="producto-stock ${stockClass}">${stockText}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        document.querySelectorAll('.producto-card').forEach(card => {
            if (!card.hasAttribute('disabled')) {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const nombre = card.dataset.nombre;
                    const precio = parseFloat(card.dataset.precio);
                    const stockDisponible = parseInt(card.dataset.stock);
                    agregarAlCarrito(id, nombre, precio, stockDisponible);
                });
            }
        });
    }
    
    /**
     * Agregar producto al carrito
     */
    function agregarAlCarrito(id, nombre, precio, stockDisponible) {
        const agenciaId = document.getElementById('agencia_id')?.value;
        
        if (!agenciaId) {
            window.mostrarNotificacion('⚠️ Primero seleccione una sucursal', 'warning');
            return;
        }
        
        if (stockDisponible <= 0) {
            window.mostrarNotificacion(`❌ Producto "${nombre}" agotado en esta sucursal`, 'error');
            return;
        }
        
        const itemExistente = carritoVentas.find(i => i.producto_id === id);
        
        if (itemExistente) {
            if (itemExistente.cantidad + 1 > stockDisponible) {
                window.mostrarNotificacion(`⚠️ Stock insuficiente. Solo hay ${stockDisponible} unidades en esta sucursal`, 'warning');
                return;
            }
            itemExistente.cantidad++;
        } else {
            carritoVentas.push({
                producto_id: id,
                producto_nombre: nombre,
                cantidad: 1,
                precio_unitario: precio
            });
        }
        
        actualizarCarrito();
        window.mostrarNotificacion(`✅ "${nombre}" agregado al carrito (Stock: ${stockDisponible})`, 'success');
    }
    
    /**
     * Actualizar carrito en UI
     */
    function actualizarCarrito() {
        const tbody = document.getElementById('carrito-body');
        const totalItems = document.getElementById('total-items');
        const totalVenta = document.getElementById('total-venta');
        
        if (!tbody) return;
        
        if (carritoVentas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4" style="color:rgba(255,255,255,0.4)">No hay productos en el carrito</td></tr>';
            if (totalItems) totalItems.textContent = '0 items';
            if (totalVenta) totalVenta.textContent = 'Bs 0.00';
            return;
        }
        
        let total = 0;
        let itemCount = 0;
        
        tbody.innerHTML = carritoVentas.map((item, index) => {
            const subtotal = item.cantidad * item.precio_unitario;
            total += subtotal;
            itemCount += item.cantidad;
            
            return `
                <tr style="background:transparent !important">
                    <td class="fw-bold" style="color:#fff !important;background:transparent !important">${escapeHtmlVentas(item.producto_nombre)}</td>
                    <td style="color:#fff !important;background:transparent !important">
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-light btn-icon" onclick="cambiarCantidadVentas(${index}, -1)">-</button>
                            <span class="fw-bold" style="min-width:40px;text-align:center;color:#fff">${item.cantidad}</span>
                            <button class="btn btn-sm btn-outline-light btn-icon" onclick="cambiarCantidadVentas(${index}, 1)">+</button>
                        </div>
                    </td>
                    <td style="color:rgba(255,255,255,0.85) !important;background:transparent !important">Bs ${item.precio_unitario.toFixed(2)}</td>
                    <td class="fw-bold" style="color:var(--amber) !important;background:transparent !important">Bs ${subtotal.toFixed(2)}</td>
                    <td style="background:transparent !important">
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="eliminarDelCarritoVentas(${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        if (totalItems) totalItems.textContent = `${itemCount} items`;
        if (totalVenta) totalVenta.textContent = `Bs ${total.toFixed(2)}`;
        calcularCambio();
    }
    
    /**
     * Cambiar cantidad de un item en el carrito
     */
    window.cambiarCantidadVentas = function(index, delta) {
        const item = carritoVentas[index];
        if (!item) return;
        
        const agenciaId = document.getElementById('agencia_id')?.value;
        const nuevaCantidad = item.cantidad + delta;
        const stockKey = `${item.producto_id}_${agenciaId}`;
        const stockDisponible = stockVentas[stockKey] || 0;
        
        if (nuevaCantidad < 1) {
            eliminarDelCarritoVentas(index);
            return;
        }
        
        if (nuevaCantidad > stockDisponible) {
            window.mostrarNotificacion(`⚠️ Stock insuficiente. Solo hay ${stockDisponible} unidades en esta sucursal`, 'warning');
            return;
        }
        
        item.cantidad = nuevaCantidad;
        actualizarCarrito();
    };
    
    /**
     * Eliminar item del carrito
     */
    window.eliminarDelCarritoVentas = function(index) {
        const item = carritoVentas[index];
        if (item) {
            carritoVentas.splice(index, 1);
            actualizarCarrito();
            window.mostrarNotificacion(`❌ "${item.producto_nombre}" eliminado del carrito`, 'info');
        }
    };
    
    /**
     * Calcular cambio
     */
    function calcularCambio() {
        const montoRecibido = parseFloat(document.getElementById('monto-recibido')?.value) || 0;
        const total = carritoVentas.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
        const cambio = montoRecibido - total;
        const cambioText = document.getElementById('cambio-text');
        
        if (cambioText) {
            if (montoRecibido > 0 && cambio >= 0) {
                cambioText.innerHTML = `💰 Cambio: Bs ${cambio.toFixed(2)}`;
                cambioText.className = 'text-success';
            } else if (montoRecibido > 0 && cambio < 0) {
                cambioText.innerHTML = `⚠️ Falta: Bs ${Math.abs(cambio).toFixed(2)}`;
                cambioText.className = 'text-danger';
            } else {
                cambioText.innerHTML = '';
            }
        }
    }
    
    /**
     * Limpiar carrito
     */
    function limpiarCarrito() {
        if (carritoVentas.length > 0) {
            Swal.fire({
                title: '¿Limpiar carrito?',
                text: 'Se eliminarán todos los productos del carrito',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, limpiar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    carritoVentas = [];
                    actualizarCarrito();
                    window.mostrarNotificacion('Carrito limpiado', 'info');
                }
            });
        }
    }
    
    /**
     * Finalizar venta
     */
    async function finalizarVenta() {
        const agenciaId = document.getElementById('agencia_id').value;
        const metodoPago = document.getElementById('metodo-pago').value;
        const clienteNombre = document.getElementById('cliente-nombre').value.trim();
        const clienteDocumento = document.getElementById('cliente-documento').value.trim();
        const montoRecibido = parseFloat(document.getElementById('monto-recibido')?.value) || 0;
        const total = carritoVentas.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
        
        if (!agenciaId) {
            window.mostrarNotificacion('Seleccione una sucursal', 'warning');
            return;
        }
        
        if (carritoVentas.length === 0) {
            window.mostrarNotificacion('Agregue productos al carrito', 'warning');
            return;
        }
        
        if (metodoPago === 'efectivo' && montoRecibido < total) {
            window.mostrarNotificacion(`Monto insuficiente. Total: Bs ${total.toFixed(2)}`, 'error');
            return;
        }
        
        const metodoTexto = metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia / QR';
        const confirmTotal = document.getElementById('confirm-total');
        const confirmMetodo = document.getElementById('confirm-metodo');
        const confirmCliente = document.getElementById('confirm-cliente');
        
        if (confirmTotal) confirmTotal.textContent = `Bs ${total.toFixed(2)}`;
        if (confirmMetodo) confirmMetodo.textContent = metodoTexto;
        if (confirmCliente) confirmCliente.textContent = clienteNombre || 'Consumidor Final';
        
        const modal = new bootstrap.Modal(document.getElementById('modalConfirmarVenta'));
        modal.show();
    }
    
    /**
     * Procesar venta
     */
    async function procesarVenta() {
        const agenciaId = document.getElementById('agencia_id').value;
        const metodoPago = document.getElementById('metodo-pago').value;
        const clienteNombre = document.getElementById('cliente-nombre').value.trim();
        const clienteDocumento = document.getElementById('cliente-documento').value.trim();
        const total = carritoVentas.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
        
        const payload = {
            agencia_id: agenciaId,
            cliente_nombre: clienteNombre || null,
            cliente_documento: clienteDocumento || null,
            metodo_pago: metodoPago,
            items: carritoVentas.map(i => ({
                producto_id: i.producto_id,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario
            }))
        };
        
        const btnConfirmar = document.getElementById('btn-confirmar-venta');
        const originalText = btnConfirmar?.innerHTML;
        
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando...';
        }
        
        try {
            const response = await window.api('/sales', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            window.mostrarNotificacion('✅ Venta realizada con éxito', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmarVenta')).hide();
            
            carritoVentas = [];
            actualizarCarrito();
            
            await Promise.all([
                cargarProductos(),
                cargarEstadisticas()
            ]);
            
            document.getElementById('cliente-nombre').value = '';
            document.getElementById('cliente-documento').value = '';
            document.getElementById('monto-recibido').value = '';
            
        } catch (error) {
            console.error("Error procesando venta:", error);
            window.mostrarNotificacion('❌ Error al procesar venta: ' + error.message, 'error');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmarVenta')).hide();
            
        } finally {
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = originalText;
            }
        }
    }
    
    /**
     * Cargar estadísticas
     */
    async function cargarEstadisticas() {
        try {
            const todasLasVentas = await window.api('/sales');

            if (todasLasVentas && Array.isArray(todasLasVentas)) {
                // Filtrar por la sucursal activa del vendedor
                const agenciaId = document.getElementById('agencia_id')?.value;
                const ventas = agenciaId
                    ? todasLasVentas.filter(v => v.agencia_id === agenciaId)
                    : todasLasVentas;

                const hoy = new Date().toISOString().split('T')[0];
                const ventasHoy = ventas.filter(v => v.fecha?.split('T')[0] === hoy);
                const totalHoy = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
                const totalGeneral = ventas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
                const promedio = ventas.length > 0 ? totalGeneral / ventas.length : 0;
                
                const ventasHoyEl = document.getElementById('ventas-hoy');
                const totalVentasEl = document.getElementById('total-ventas');
                const clientesAtendidosEl = document.getElementById('clientes-atendidos');
                const promedioVentaEl = document.getElementById('promedio-venta');
                
                if (ventasHoyEl) ventasHoyEl.textContent = `Bs ${totalHoy.toFixed(2)}`;
                if (totalVentasEl) totalVentasEl.textContent = `Bs ${totalGeneral.toFixed(2)}`;
                if (clientesAtendidosEl) clientesAtendidosEl.textContent = ventasHoy.length;
                if (promedioVentaEl) promedioVentaEl.textContent = `Bs ${promedio.toFixed(2)}`;
            }
        } catch (error) {
            console.error("Error cargando estadísticas:", error);
        }
    }
    
    /**
     * Configurar eventos
     */
    function configurarEventos() {
        const buscador = document.getElementById('buscador-producto');
        if (buscador) {
            buscador.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value.toLowerCase();
                renderizarProductos();
            });
        }
        
        const btnFinalizar = document.getElementById('btn-finalizar-venta');
        if (btnFinalizar) {
            btnFinalizar.addEventListener('click', finalizarVenta);
        }
        
        const btnLimpiar = document.getElementById('btn-limpiar-carrito');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', limpiarCarrito);
        }
        
        const btnConfirmar = document.getElementById('btn-confirmar-venta');
        if (btnConfirmar) {
            btnConfirmar.addEventListener('click', procesarVenta);
        }
        
        const montoRecibido = document.getElementById('monto-recibido');
        if (montoRecibido) {
            montoRecibido.addEventListener('input', calcularCambio);
        }
        
        const selectAgencia = document.getElementById('agencia_id');
        if (selectAgencia) {
            selectAgencia.addEventListener('change', () => {
                carritoVentas = [];
                actualizarCarrito();
                renderizarProductos();
            });
        }
    }
    
    /**
     * Escapar HTML
     */
    function escapeHtmlVentas(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
})(); // Fin del IIFE