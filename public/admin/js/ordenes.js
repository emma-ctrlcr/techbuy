let ordenes = [];

async function ordenesInit() {
    await (window.authPromise || Promise.resolve());
    await cargarOrdenes();

    document.getElementById('eliminarTodasBtn').addEventListener('click', async () => {
        const ok = await showConfirm('Eliminar todas las órdenes', '¿Estás seguro? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            await apiFetch(API.ordenes, { method: 'DELETE' });
            showAlert('Todas las órdenes fueron eliminadas', 'success');
            await cargarOrdenes();
        } catch (e) {
            showAlert('Error: ' + e.message, 'error');
        }
    });
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.ordenesInit = ordenesInit;
document.addEventListener('DOMContentLoaded', ordenesInit);

async function cargarOrdenes() {
    const tbody = document.getElementById('ordenesTableBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        ordenes = await apiFetch(API.ordenes);
        if (ordenes.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';
        tbody.innerHTML = ordenes.map(o => `
            <tr>
                <td>#${o.id_pedido}</td>
                <td class="table-text-truncate" title="${o.usuario_nombre || ''}">${o.usuario_nombre || '—'}</td>
                <td>${formatDate(o.fecha)}</td>
                <td><strong>C$${formatPrice(o.total)}</strong></td>
                <td>${o.discount > 0 ? `<span class="order-discount">-C$${formatPrice(o.discount)}</span>` : '—'}</td>
                <td>${o.dept || '—'}</td>
                <td><span class="tag tag-success"><i class="fas fa-check-circle"></i> ${o.status || 'Completado'}</span></td>
                <td style="text-align:center"><a href="/admin/factura-admin.html?id=${o.id_pedido}" class="btn btn-info btn-sm"><i class="fas fa-file-pdf"></i> Factura</a></td>
                <td style="text-align:center">
                    <button class="btn btn-danger btn-sm" onclick="eliminarOrden(${o.id_pedido})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> Error: ${e.message}</td></tr>`;
    }
}

async function eliminarOrden(id) {
    const ok = await showConfirm('Eliminar orden', '¿Eliminar esta orden?');
    if (!ok) return;
    try {
        await apiFetch(API.ordenes + '/' + id, { method: 'DELETE' });
        showAlert('Orden eliminada', 'success');
        await cargarOrdenes();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.eliminarOrden = eliminarOrden;
