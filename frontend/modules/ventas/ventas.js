window.initVentas = async function() {
    let carrito = [];
    
    // Cargar agencias al iniciar
    const agencias = await api('/rrhh/agencias');
    const sAgencia = document.getElementById('agencia_id');
    sAgencia.innerHTML = agencias.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');

    // Cargar productos para el select
    const productos = await api('/catalog/productos');
    const sProducto = document.getElementById('producto_id');
    sProducto.innerHTML = productos.map(p => `<option value="${p.id}" data-precio="${p.precio_base}" data-nombre="${p.nombre}">${p.nombre} (Bs. ${p.precio_base})</option>`).join('');

    window.agregarAlCarrito = () => {
        const prodSelect = document.getElementById('producto_id');
        const selected = prodSelect.options[prodSelect.selectedIndex];
        const item = {
            producto_id: selected.value,
            producto_nombre: selected.dataset.nombre,
            cantidad: parseInt(document.getElementById('cantidad').value),
            precio_unitario: parseFloat(selected.dataset.precio)
        };
        carrito.push(item);
        actualizarCarrito();
    };

    function actualizarCarrito() {
        const tbody = document.getElementById('carrito-body');
        tbody.innerHTML = carrito.map(i => `<tr><td>${i.producto_nombre}</td><td>${i.cantidad}</td><td>${i.precio_unitario}</td><td>${i.precio_unitario * i.cantidad}</td></tr>`).join('');
        document.getElementById('total-venta').innerText = carrito.reduce((sum, i) => sum + (i.precio_unitario * i.cantidad), 0).toFixed(2);
    }

    window.finalizarVenta = async () => {
        const payload = {
            agencia_id: document.getElementById('agencia_id').value,
            metodo_pago: "efectivo",
            items: carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
        };

        try {
            await api('/ventas', { method: 'POST', body: JSON.stringify(payload) });
            alert("Venta realizada con éxito");
            carrito = [];
            actualizarCarrito();
        } catch (e) {
            alert("Error al procesar venta: " + e.message);
        }
    };
};