// Compras Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let ordenesData = [];
    
    // Variables que necesitan ser globales (para acceso desde HTML)
    window.productosCompra = window.productosCompra || [];
    window.proveedoresCompra = window.proveedoresCompra || [];
    window.agenciasCompra = window.agenciasCompra || [];
    window.draftItems = window.draftItems || [];
    window.stockProductos = window.stockProductos || {};
    
    /**
     * Inicializar módulo de compras
     */
    window.initCompras = async () => {
        console.log("📦 Iniciando módulo de Compras...");
        
        mostrarLoading();
        
        await Promise.all([
            window.cargarProveedores(),
            window.cargarProductosCatalog(),
            window.cargarAgencias(),
            window.cargarOrdenes()
        ]);
        
        configurarEventos();
        actualizarEstadisticas();
    };
    
    /**
     * Mostrar loading
     */
    function mostrarLoading() {
        const tbodyOrdenes = document.getElementById('tbody-ordenes');
        if (tbodyOrdenes) {
            tbodyOrdenes.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Cargando órdenes...</p></td></tr>';
        }
    }
    
    /**
     * Validar formato de email
     */
    function validarEmail(email) {
        if (!email || email.trim() === '') return true;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Cargar agencias disponibles (para origen y destino)
     */
    window.cargarAgencias = async () => {
        try {
            const agencias = await window.api('/rrhh/agencias');
            if (agencias && Array.isArray(agencias)) {
                window.agenciasCompra = agencias;
                
                const selectAgenciaOrigen = document.getElementById('select-agencia-origen');
                const selectAgenciaDestino = document.getElementById('select-agencia-destino');
                
                const opciones = '<option value="">Seleccione una agencia...</option>' + 
                    agencias.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)} - ${a.ubicacion || 'Sin ubicación'}</option>`).join('');
                
                if (selectAgenciaOrigen) selectAgenciaOrigen.innerHTML = opciones;
                if (selectAgenciaDestino) selectAgenciaDestino.innerHTML = opciones;
            }
        } catch (error) {
            console.error("Error cargando agencias:", error);
        }
    };
    
    /**
     * Cargar proveedores
     */
    window.cargarProveedores = async () => {
        try {
            window.proveedoresCompra = await window.api('/compras/proveedores');
            
            const tbody = document.getElementById('tbody-proveedores');
            const select = document.getElementById('select-proveedor');
            
            if (tbody && select) {
                tbody.innerHTML = '';
                select.innerHTML = '<option value="">Seleccione un proveedor...</option>';
                
                if (!window.proveedoresCompra || window.proveedoresCompra.length === 0) {
                    tbody.innerHTML = '<td><td colspan="4" class="text-center py-4 text-muted">No hay proveedores registrados. Cree uno nuevo →</div></td>';
                    select.innerHTML += '<option value="" disabled>No hay proveedores disponibles</option>';
                } else {
                    window.proveedoresCompra.forEach(p => {
                        tbody.innerHTML += `
                            <tr>
                                <td class="fw-bold">${escapeHtml(p.nombre)}</div>
                                <td><code>${escapeHtml(p.nit)}</code></div>
                                <td>${escapeHtml(p.telefono || '-')}</div>
                                <td>${escapeHtml(p.email || '-')}</div>
                            </div>
                        `;
                        select.innerHTML += `<option value="${p.id}">${escapeHtml(p.nombre)} (${p.nit})</option>`;
                    });
                }
            }
            
            const totalProveedores = document.getElementById('total-proveedores');
            if (totalProveedores) totalProveedores.textContent = window.proveedoresCompra?.length || 0;
            
        } catch (error) {
            console.error("Error cargando proveedores:", error);
            window.mostrarNotificacion('Error cargando proveedores: ' + error.message, 'error');
            
            const tbody = document.getElementById('tbody-proveedores');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Error cargando proveedores</div></td>';
            }
        }
    };
    
    /**
     * Cargar productos del catálogo Y su stock REAL desde almacén por agencia
     */
    window.cargarProductosCatalog = async () => {
        try {
            const [productos, stock] = await Promise.all([
                window.api('/catalog/products'),
                window.api('/almacen/stock')
            ]);
            
            window.productosCompra = productos || [];
            
            if (stock && Array.isArray(stock)) {
                window.stockProductos = {};
                stock.forEach(item => {
                    const key = `${item.producto_id}_${item.agencia_id}`;
                    window.stockProductos[key] = item.cantidad;
                });
                console.log("📊 Stock cargado por agencia:", window.stockProductos);
            } else {
                window.stockProductos = {};
            }
            
            const select = document.getElementById('select-producto');
            
            if (select) {
                select.innerHTML = '<option value="">Seleccione un producto...</option>';
                if (window.productosCompra && window.productosCompra.length > 0) {
                    window.productosCompra.forEach(p => {
                        const precio = parseFloat(p.precio_base) || 0;
                        select.innerHTML += `<option value="${p.id}" 
                            data-nombre="${escapeHtml(p.nombre)}"
                            data-precio="${precio}">
                            ${escapeHtml(p.nombre)} - Bs ${precio.toFixed(2)}
                        </option>`;
                    });
                } else {
                    select.innerHTML += '<option value="" disabled>No hay productos disponibles</option>';
                }
            }
            
            const selectProducto = document.getElementById('select-producto');
            const selectAgenciaOrigen = document.getElementById('select-agencia-origen');
            
            if (selectProducto) {
                selectProducto.addEventListener('change', mostrarInfoProductoPorAgencia);
            }
            if (selectAgenciaOrigen) {
                selectAgenciaOrigen.addEventListener('change', mostrarInfoProductoPorAgencia);
            }
            
        } catch (error) {
            console.error("Error cargando productos:", error);
            window.mostrarNotificacion('Error cargando productos: ' + error.message, 'error');
        }
    };
    
    /**
     * Mostrar información del producto según la agencia origen seleccionada
     */
    function mostrarInfoProductoPorAgencia() {
        const selectProducto = document.getElementById('select-producto');
        const selectAgenciaOrigen = document.getElementById('select-agencia-origen');
        const selectedOption = selectProducto.options[selectProducto.selectedIndex];
        const infoDiv = document.getElementById('producto-info');
        const stockSpan = document.getElementById('producto-stock');
        const advertenciaSpan = document.getElementById('stock-advertencia');
        const cantidadInput = document.getElementById('input-cantidad');
        const costoInput = document.getElementById('input-costo');
        const cantidadHelp = document.getElementById('cantidad-help');
        const btnAgregar = document.getElementById('btn-agregar');
        const subtotalPreview = document.getElementById('subtotal-preview');
        const subtotalValue = document.getElementById('subtotal-value');
        
        if (!selectedOption || !selectedOption.value || !selectAgenciaOrigen || !selectAgenciaOrigen.value) {
            if (infoDiv) infoDiv.classList.add('d-none');
            if (subtotalPreview) subtotalPreview.classList.add('d-none');
            return;
        }
        
        const productoId = selectedOption.value;
        const agenciaOrigenId = selectAgenciaOrigen.value;
        const nombreProducto = selectedOption.dataset.nombre || selectedOption.text.split(' - Bs')[0];
        const precioCatalogo = parseFloat(selectedOption.dataset.precio) || 0;
        
        const stockKey = `${productoId}_${agenciaOrigenId}`;
        const stockReal = window.stockProductos[stockKey] || 0;
        
        console.log(`Producto: ${nombreProducto}, Agencia Origen: ${agenciaOrigenId}, Stock: ${stockReal}`);
        
        if (stockSpan) stockSpan.textContent = stockReal;
        
        if (infoDiv) {
            if (!agenciaOrigenId) {
                advertenciaSpan.innerHTML = '⚠️ Seleccione una agencia para ver stock real';
                advertenciaSpan.className = 'text-warning ms-2 fw-bold';
                infoDiv.classList.remove('d-none');
                if (btnAgregar) btnAgregar.disabled = true;
                if (cantidadInput) cantidadInput.disabled = true;
            } else if (stockReal <= 0) {
                advertenciaSpan.innerHTML = `❌ ¡Producto AGOTADO en esta agencia! Stock: ${stockReal}`;
                advertenciaSpan.className = 'text-danger ms-2 fw-bold';
                infoDiv.classList.remove('d-none');
                if (btnAgregar) btnAgregar.disabled = true;
                if (cantidadInput) cantidadInput.disabled = true;
            } else if (stockReal <= 5) {
                advertenciaSpan.innerHTML = `⚠️ Stock BAJO en esta agencia (solo ${stockReal} unidades)`;
                advertenciaSpan.className = 'text-warning ms-2 fw-bold';
                infoDiv.classList.remove('d-none');
                if (btnAgregar) btnAgregar.disabled = false;
                if (cantidadInput) cantidadInput.disabled = false;
            } else {
                advertenciaSpan.innerHTML = `✅ Stock disponible en esta agencia: ${stockReal} unidades`;
                advertenciaSpan.className = 'text-success ms-2';
                infoDiv.classList.remove('d-none');
                if (btnAgregar) btnAgregar.disabled = false;
                if (cantidadInput) cantidadInput.disabled = false;
            }
        }
        
        if (costoInput && precioCatalogo > 0) {
            costoInput.value = precioCatalogo;
        }
        
        if (cantidadInput && stockReal > 0) {
            cantidadInput.min = 1;
            cantidadInput.max = stockReal;
            cantidadInput.placeholder = `Máx: ${stockReal}`;
        }
        
        if (cantidadInput && costoInput) {
            const newCantidad = cantidadInput.cloneNode(true);
            const newCosto = costoInput.cloneNode(true);
            cantidadInput.parentNode.replaceChild(newCantidad, cantidadInput);
            costoInput.parentNode.replaceChild(newCosto, costoInput);
            
            function calcularSubtotal() {
                const cantidad = parseInt(newCantidad.value) || 0;
                const costo = parseFloat(newCosto.value) || 0;
                const subtotal = cantidad * costo;
                
                if (subtotalPreview && subtotalValue) {
                    if (cantidad > 0 && costo > 0) {
                        subtotalValue.textContent = `Bs ${subtotal.toFixed(2)}`;
                        subtotalPreview.classList.remove('d-none');
                    } else {
                        subtotalPreview.classList.add('d-none');
                    }
                }
                
                if (cantidadHelp) {
                    if (stockReal === 0) {
                        cantidadHelp.innerHTML = '❌ Producto agotado en esta agencia';
                        cantidadHelp.className = 'text-danger';
                        if (btnAgregar) btnAgregar.disabled = true;
                    } else if (cantidad > stockReal) {
                        cantidadHelp.innerHTML = `⚠️ La cantidad (${cantidad}) supera el stock disponible (${stockReal}) en esta agencia`;
                        cantidadHelp.className = 'text-danger';
                        if (btnAgregar) btnAgregar.disabled = true;
                    } else if (cantidad <= 0) {
                        cantidadHelp.innerHTML = `Ingrese una cantidad entre 1 y ${stockReal}`;
                        cantidadHelp.className = 'text-warning';
                        if (btnAgregar) btnAgregar.disabled = true;
                    } else {
                        cantidadHelp.innerHTML = `✅ Stock suficiente: ${stockReal} unidades disponibles en esta agencia`;
                        cantidadHelp.className = 'text-success';
                        if (btnAgregar) btnAgregar.disabled = false;
                    }
                }
            }
            
            newCantidad.addEventListener('input', calcularSubtotal);
            newCosto.addEventListener('input', calcularSubtotal);
            calcularSubtotal();
            
            document.getElementById('input-cantidad').value = newCantidad.value;
            document.getElementById('input-costo').value = newCosto.value;
        }
    }
    
    /**
     * Agregar item al carrito (con agencia origen y destino)
     */
    window.agregarItem = (e) => {
        e.preventDefault();
        
        const selectProd = document.getElementById('select-producto');
        const selectAgenciaOrigen = document.getElementById('select-agencia-origen');
        const selectAgenciaDestino = document.getElementById('select-agencia-destino');
        const selectedOption = selectProd.options[selectProd.selectedIndex];
        
        const idProd = selectProd.value;
        const agenciaOrigenId = selectAgenciaOrigen.value;
        const agenciaDestinoId = selectAgenciaDestino.value;
        const nombreProd = selectedOption?.dataset?.nombre || selectedOption?.text?.split(' - Bs')[0] || '';
        
        const stockKey = `${idProd}_${agenciaOrigenId}`;
        const stockDisponible = window.stockProductos[stockKey] || 0;
        
        const cant = parseInt(document.getElementById('input-cantidad').value);
        let costo = parseFloat(document.getElementById('input-costo').value);
        const precioCatalogo = parseFloat(selectedOption?.dataset?.precio) || 0;
        
        if (!idProd) {
            window.mostrarNotificacion("Seleccione un producto", 'warning');
            return;
        }
        
        if (!agenciaOrigenId) {
            window.mostrarNotificacion("Seleccione una agencia origen", 'warning');
            return;
        }
        
        if (!agenciaDestinoId) {
            window.mostrarNotificacion("Seleccione una agencia destino", 'warning');
            return;
        }
        
        if (!cant || cant <= 0) {
            window.mostrarNotificacion("Ingrese una cantidad válida", 'warning');
            return;
        }
        
        if (stockDisponible === 0) {
            window.mostrarNotificacion(`❌ Producto "${nombreProd}" está agotado en la agencia origen. No se puede transferir.`, 'error');
            return;
        }
        
        if (cant > stockDisponible) {
            window.mostrarNotificacion(`⚠️ Stock insuficiente en agencia origen. Solo hay ${stockDisponible} unidades.`, 'error');
            return;
        }
        
        if (!costo || costo <= 0) {
            costo = precioCatalogo;
            if (costo <= 0) {
                window.mostrarNotificacion("Ingrese un costo válido", 'warning');
                return;
            }
        }
        
        const subtotal = cant * costo;
        
        window.draftItems.push({
            producto_id: idProd,
            nombre: nombreProd,
            cantidad: cant,
            precio_unitario: costo,
            subtotal: subtotal,
            agencia_origen_id: agenciaOrigenId,
            agencia_destino_id: agenciaDestinoId,
            stock_antes_origen: stockDisponible
        });
        
        window.renderDraft();
        
        document.getElementById('input-cantidad').value = '';
        document.getElementById('input-costo').value = precioCatalogo;
        
        const cantidadHelp = document.getElementById('cantidad-help');
        if (cantidadHelp) cantidadHelp.innerHTML = '';
        
        const subtotalPreview = document.getElementById('subtotal-preview');
        if (subtotalPreview) subtotalPreview.classList.add('d-none');
        
        const nuevoStockOrigen = stockDisponible - cant;
        window.stockProductos[stockKey] = nuevoStockOrigen;
        
        if (nuevoStockOrigen <= 0) {
            window.mostrarNotificacion(`⚠️ Producto "${nombreProd}" se ha agotado en la agencia origen`, 'warning');
        }
        
        mostrarInfoProductoPorAgencia();
        
        window.mostrarNotificacion(`✅ "${nombreProd}": ${cant} unidades transferidas de origen a destino`, 'success');
    };
    
    /**
     * Renderizar items del carrito
     */
    window.renderDraft = () => {
        const tbody = document.getElementById('tbody-draft');
        if (!tbody) return;
        
        if (window.draftItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No hay productos agregados</div></td>';
            const totalDraft = document.getElementById('total-draft');
            if (totalDraft) totalDraft.innerHTML = 'Total: Bs 0.00';
            return;
        }
        
        tbody.innerHTML = '';
        let total = 0;
        
        window.draftItems.forEach((item, index) => {
            total += item.subtotal;
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${escapeHtml(item.nombre)}</div>
                    <td>${item.cantidad} unidades</div>
                    <td class="text-primary fw-bold">Bs ${item.subtotal.toFixed(2)}</div>
                    <td>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="quitarItem(${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        const totalDraft = document.getElementById('total-draft');
        if (totalDraft) totalDraft.innerHTML = `Total: Bs ${total.toFixed(2)}`;
    };
    
    /**
     * Quitar item del carrito
     */
    window.quitarItem = (index) => {
        const itemRemovido = window.draftItems[index];
        window.draftItems.splice(index, 1);
        window.renderDraft();
        if (itemRemovido) {
            window.mostrarNotificacion(`Producto "${itemRemovido.nombre}" removido`, 'info');
        }
    };
    
    /**
     * Crear proveedor
     */
    window.crearProveedor = async (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('prov-nombre').value.trim();
        const nit = document.getElementById('prov-nit').value.trim();
        const telefono = document.getElementById('prov-telefono').value.trim();
        const email = document.getElementById('prov-email').value.trim();
        
        if (!nombre) {
            window.mostrarNotificacion('El nombre del proveedor es obligatorio', 'warning');
            return;
        }
        
        if (!nit) {
            window.mostrarNotificacion('El NIT es obligatorio', 'warning');
            return;
        }
        
        if (nit.length < 3) {
            window.mostrarNotificacion('El NIT debe tener al menos 3 caracteres', 'warning');
            return;
        }
        
        if (email && !validarEmail(email)) {
            window.mostrarNotificacion('Ingrese un email válido (ej: proveedor@empresa.com)', 'warning');
            return;
        }
        
        if (window.proveedoresCompra && window.proveedoresCompra.length > 0) {
            const existe = window.proveedoresCompra.find(p => p.nit === nit);
            if (existe) {
                Swal.fire({
                    title: 'Proveedor ya existe',
                    html: `
                        <div class="text-start">
                            <p>Ya existe un proveedor registrado con el NIT: <strong>${nit}</strong></p>
                            <p><strong>Nombre:</strong> ${existe.nombre}</p>
                            <hr>
                            <p class="text-muted">Si deseas modificar los datos, edita el proveedor existente.</p>
                        </div>
                    `,
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }
        }
        
        const payload = {
            nombre: nombre,
            nit: nit,
            telefono: telefono || null,
            email: email || null
        };
        
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const originalText = btnSubmit?.innerHTML;
        if (btnSubmit) {
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
            btnSubmit.disabled = true;
        }
        
        try {
            await window.api('/compras/proveedores', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            window.mostrarNotificacion(`Proveedor "${nombre}" creado exitosamente`, 'success');
            document.getElementById('form-proveedor').reset();
            await window.cargarProveedores();
            
        } catch (error) {
            console.error('Error creando proveedor:', error);
            
            let mensajeError = error.message;
            
            if (error.message.includes('NIT') && error.message.includes('duplicado')) {
                mensajeError = 'Ya existe un proveedor con este NIT. Verifique el número e intente nuevamente.';
            } else if (error.message.includes('email')) {
                mensajeError = 'El email ingresado no es válido. Use formato: nombre@dominio.com';
            } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
                mensajeError = 'Ya existe un proveedor con ese NIT o nombre';
            } else if (error.message.includes('400')) {
                mensajeError = 'El servidor rechazó la solicitud. Verifique que el NIT no esté duplicado.';
            } else if (error.message.includes('422')) {
                mensajeError = 'Datos inválidos. Verifique que todos los campos estén correctos.';
            }
            
            window.mostrarNotificacion(`Error: ${mensajeError}`, 'error');
            
            Swal.fire({
                title: 'Error al crear proveedor',
                html: `
                    <div class="text-start">
                        <p><strong>Detalle:</strong> ${mensajeError}</p>
                        <hr>
                        <p class="text-muted small">Consejos:</p>
                        <ul class="text-muted small">
                            <li>Verifique que el NIT no esté registrado previamente</li>
                            <li>Revise que el email tenga el formato correcto</li>
                            <li>Complete todos los campos obligatorios (*)</li>
                        </ul>
                    </div>
                `,
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
            
        } finally {
            if (btnSubmit) {
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;
            }
        }
    };
    
    /**
     * Crear orden de compra
     */
    window.crearOrdenCompra = async () => {
        const proveedor_id = document.getElementById('select-proveedor').value;
        const agencia_origen_id = document.getElementById('select-agencia-origen').value;
        const agencia_destino_id = document.getElementById('select-agencia-destino').value;
        
        if (!proveedor_id) {
            window.mostrarNotificacion("Seleccione un proveedor", 'warning');
            return;
        }
        
        if (!agencia_origen_id) {
            window.mostrarNotificacion("Seleccione una agencia origen", 'warning');
            return;
        }
        
        if (!agencia_destino_id) {
            window.mostrarNotificacion("Seleccione una agencia destino", 'warning');
            return;
        }
        
        if (window.draftItems.length === 0) {
            window.mostrarNotificacion("Agregue al menos un producto", 'warning');
            return;
        }
        
        const items = window.draftItems.map(i => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario
        }));
        
        const total = window.draftItems.reduce((sum, i) => sum + i.subtotal, 0);
        
        const confirmacion = await Swal.fire({
            title: '¿Emitir orden de compra?',
            html: `
                <div class="text-start">
                    <p><strong>Proveedor:</strong> ${document.getElementById('select-proveedor').options[document.getElementById('select-proveedor').selectedIndex]?.text}</p>
                    <p><strong>Agencia Origen:</strong> ${document.getElementById('select-agencia-origen').options[document.getElementById('select-agencia-origen').selectedIndex]?.text}</p>
                    <p><strong>Agencia Destino:</strong> ${document.getElementById('select-agencia-destino').options[document.getElementById('select-agencia-destino').selectedIndex]?.text}</p>
                    <p><strong>Total:</strong> <span class="text-primary fw-bold">Bs ${total.toFixed(2)}</span></p>
                    <p><strong>Productos:</strong> ${window.draftItems.length} items</p>
                    <hr>
                    <p class="text-muted small">⚠️ Esta acción descontará el stock de la agencia origen</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, emitir orden',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmacion.isConfirmed) return;
        
        const btnEmitir = document.querySelector('#tab-nueva .btn-success');
        const originalText = btnEmitir?.innerHTML;
        if (btnEmitir) {
            btnEmitir.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando...';
            btnEmitir.disabled = true;
        }
        
        try {
            const payload = {
                proveedor_id: proveedor_id,
                agencia_origen_id: agencia_origen_id,
                agencia_destino_id: agencia_destino_id,
                items: items
            };
            
            await window.api('/compras/ordenes-compra', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            for (const item of window.draftItems) {
                const movimientoSalida = {
                    tipo: 'salida',
                    agencia_id: agencia_origen_id,
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    motivo: `Transferencia por orden de compra`
                };
                
                await window.api('/almacen/movimientos', {
                    method: 'POST',
                    body: JSON.stringify(movimientoSalida)
                });
                
                const movimientoEntrada = {
                    tipo: 'entrada',
                    agencia_id: agencia_destino_id,
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    motivo: `Transferencia desde agencia origen`
                };
                
                await window.api('/almacen/movimientos', {
                    method: 'POST',
                    body: JSON.stringify(movimientoEntrada)
                });
            }
            
            window.mostrarNotificacion('✅ Orden de compra emitida y stock actualizado correctamente', 'success');
            
            window.draftItems = [];
            window.renderDraft();
            
            await Promise.all([
                window.cargarProveedores(),
                window.cargarProductosCatalog(),
                window.cargarAgencias(),
                window.cargarOrdenes()
            ]);
            
            actualizarEstadisticas();
            
            document.getElementById('select-producto').value = '';
            document.getElementById('select-agencia-origen').value = '';
            document.getElementById('select-agencia-destino').value = '';
            document.getElementById('input-cantidad').value = '';
            document.getElementById('input-costo').value = '';
            
            const infoDiv = document.getElementById('producto-info');
            if (infoDiv) infoDiv.classList.add('d-none');
            
            const subtotalPreview = document.getElementById('subtotal-preview');
            if (subtotalPreview) subtotalPreview.classList.add('d-none');
            
            Swal.fire({
                title: '¡Éxito!',
                text: 'Orden de compra procesada y stock actualizado correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            cambiarPestana('historial');
            
        } catch (error) {
            console.error("Error en el proceso:", error);
            window.mostrarNotificacion("❌ Error: " + error.message, 'error');
            
            Swal.fire({
                title: 'Error al procesar',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
            
        } finally {
            if (btnEmitir) {
                btnEmitir.innerHTML = originalText;
                btnEmitir.disabled = false;
            }
        }
    };
    
    /**
     * Cargar órdenes de compra
     */
    window.cargarOrdenes = async () => {
        try {
            const ordenes = await window.api('/compras/ordenes-compra');
            ordenesData = ordenes || [];
            
            const estadoFiltro = document.getElementById('filtro-estado')?.value || 'todas';
            const ordenesFiltradas = estadoFiltro === 'todas' 
                ? ordenesData 
                : ordenesData.filter(o => o.estado === estadoFiltro);
            
            const tbody = document.getElementById('tbody-ordenes');
            if (!tbody) return;
            
            if (ordenesFiltradas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay órdenes de compra</div></td>';
                actualizarEstadisticas();
                return;
            }
            
            ordenesFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            
            tbody.innerHTML = ordenesFiltradas.map(o => {
                const fecha = new Date(o.fecha).toLocaleString();
                const estadoBadge = o.estado === 'recibida' 
                    ? '<span class="badge-estado badge-recibida"><i class="bi bi-check-circle"></i> Recibida</span>'
                    : '<span class="badge-estado badge-pendiente"><i class="bi bi-clock"></i> Pendiente</span>';
                
                const btnRecepcion = o.estado === 'pendiente' 
                    ? `<button class="btn btn-sm btn-success" onclick="recepcionarOrden('${o.id}')">
                         <i class="bi bi-box-seam me-1"></i> Recepcionar
                       </button>` 
                    : `<span class="text-muted"><i class="bi bi-check-circle"></i> Completada</span>`;
                
                const proveedor = window.proveedoresCompra?.find(p => p.id === o.proveedor_id);
                const nombreProveedor = proveedor?.nombre || o.proveedor_id?.substring(0, 8) || '-';
                
                return `
                    <tr>
                        <td><small>${fecha}</small></div>
                        <td><code title="${o.id}">${o.id?.substring(0, 8)}...</code></div>
                        <td>${escapeHtml(nombreProveedor)}</div>
                        <td class="fw-bold text-primary">Bs ${parseFloat(o.total).toFixed(2)}</div>
                        <td>${estadoBadge}</div>
                        <td>${btnRecepcion}</div>
                    </div>
                `;
            }).join('');
            
            actualizarEstadisticas();
            
        } catch (error) {
            console.error("Error cargando órdenes:", error);
            window.mostrarNotificacion('Error cargando órdenes: ' + error.message, 'error');
        }
    };
    
    /**
     * Recepcionar orden de compra
     */
    window.recepcionarOrden = async (ordenId) => {
        const confirmacion = await Swal.fire({
            title: '¿Confirmar recepción?',
            html: `
                <div class="text-start">
                    <p><strong>Esta acción:</strong></p>
                    <ul>
                        <li>✅ Sumará los productos al almacén</li>
                        <li>💰 Registrará la deuda en pagos</li>
                        <li>📋 Cambiará el estado a "Recibida"</li>
                    </ul>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Sí, confirmar recepción',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745'
        });
        
        if (!confirmacion.isConfirmed) return;
        
        try {
            await window.api(`/compras/ordenes-compra/${ordenId}/recepcion`, {
                method: 'POST',
                body: JSON.stringify({})
            });
            
            window.mostrarNotificacion("¡Recepción exitosa! El stock ha sido actualizado.", 'success');
            await window.cargarOrdenes();
            
        } catch (error) {
            console.error("Error en recepción:", error);
            window.mostrarNotificacion("Error: " + error.message, 'error');
        }
    };
    
    /**
     * Cambiar entre pestañas
     */
    function cambiarPestana(tabId) {
        const tabs = ['historial', 'nueva', 'proveedores'];
        tabs.forEach(t => {
            const tabPane = document.getElementById(`tab-${t}`);
            const tabBtn = document.getElementById(`tab-${t}-btn`);
            if (tabPane && tabBtn) {
                if (t === tabId) {
                    tabPane.classList.add('show', 'active');
                    tabBtn.classList.add('active');
                } else {
                    tabPane.classList.remove('show', 'active');
                    tabBtn.classList.remove('active');
                }
            }
        });
    }
    
    /**
     * Actualizar estadísticas
     */
    function actualizarEstadisticas() {
        const total = document.getElementById('total-ordenes');
        const pendientes = document.getElementById('ordenes-pendientes');
        const recibidas = document.getElementById('ordenes-recibidas');
        
        if (total) total.textContent = ordenesData.length;
        if (pendientes) pendientes.textContent = ordenesData.filter(o => o.estado === 'pendiente').length;
        if (recibidas) recibidas.textContent = ordenesData.filter(o => o.estado === 'recibida').length;
    }
    
    /**
     * Configurar eventos
     */
    function configurarEventos() {
        const btnHistorial = document.getElementById('tab-historial-btn');
        const btnNueva = document.getElementById('tab-nueva-btn');
        const btnProveedores = document.getElementById('tab-proveedores-btn');
        
        if (btnHistorial) btnHistorial.addEventListener('click', () => cambiarPestana('historial'));
        if (btnNueva) btnNueva.addEventListener('click', () => cambiarPestana('nueva'));
        if (btnProveedores) btnProveedores.addEventListener('click', () => cambiarPestana('proveedores'));
        
        const formAddItem = document.getElementById('form-add-item');
        if (formAddItem) formAddItem.addEventListener('submit', window.agregarItem);
        
        const formProveedor = document.getElementById('form-proveedor');
        if (formProveedor) formProveedor.addEventListener('submit', window.crearProveedor);
        
        const filtroEstado = document.getElementById('filtro-estado');
        if (filtroEstado) filtroEstado.addEventListener('change', () => window.cargarOrdenes());
        
        const buscarProveedor = document.getElementById('buscar-proveedor');
        if (buscarProveedor) {
            buscarProveedor.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#tbody-proveedores tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
            });
        }
    }
    
    /**
     * Escapar HTML
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
})(); // Fin del IIFE