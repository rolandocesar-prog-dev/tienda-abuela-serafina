window.initAlmacen = async function() {
    const tbody = document.getElementById('almacen-body');
    const form = document.getElementById('form-movimiento');

    async function cargarStock() {
        try {
            const data = await api('/almacen/movimientos/stock');
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td>${item.producto_id}</td>
                    <td>${item.agencia_id}</td>
                    <td>${item.cantidad}</td>
                </tr>
            `).join('');
        } catch (error) {
            alert("Error al cargar stock: " + error.message);
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            tipo: document.getElementById('tipo').value,
            agencia_id: document.getElementById('agencia_id').value,
            producto_id: document.getElementById('producto_id').value,
            cantidad: parseInt(document.getElementById('cantidad').value)
        };
        
        try {
            await api('/almacen/movimientos', { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            form.reset();
            cargarStock();
        } catch (error) {
            alert("Error al registrar: " + error.message);
        }
    };

    cargarStock();
};