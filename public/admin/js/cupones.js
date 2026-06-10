async function cuponesInit() {
    await (window.authPromise || Promise.resolve());
    await cargarCupones();

    document.getElementById('cuponForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';

        try {
            const descuentoInput = document.getElementById('cuponDescuento').value.trim();
            const descuentoVal = parseInt(descuentoInput, 10);
            if (!descuentoInput || isNaN(descuentoVal) || descuentoVal < 1 || descuentoVal > 100 || String(descuentoVal) !== descuentoInput) {
                showAlert('El descuento debe ser un número entero entre 1 y 100', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plus-circle"></i> Crear Cupón';
                return;
            }
            await apiFetch(API.cupones, {
                method: 'POST',
                body: JSON.stringify({
                    codigo: document.getElementById('cuponCodigo').value,
                    descuento: descuentoVal,
                    usos_max: document.getElementById('cuponUsosMax').value || null,
                    fecha_inicio: document.getElementById('cuponFechaInicio').value || null,
                    fecha_fin: document.getElementById('cuponFechaFin').value || null,
                    activo: document.getElementById('cuponActivo').checked,
                }),
            });
            showAlert('Cupón creado exitosamente', 'success');
            e.target.reset();
            document.getElementById('cuponActivo').checked = true;
            await cargarCupones();
        } catch (e) {
            showAlert('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> Crear Cupón';
        }
    });
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.cuponesInit = cuponesInit;
document.addEventListener('DOMContentLoaded', cuponesInit);

async function cargarCupones() {
    const tbody = document.getElementById('cuponesTableBody');
    try {
        const cupones = await apiFetch(API.cupones);
        if (cupones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;">No hay cupones registrados</td></tr>';
            return;
        }
        tbody.innerHTML = cupones.map(c => {
            const pct = parseInt(c.descuento, 10);
            const status = c.status || (c.activo ? 'activo' : 'inactivo');
            const badgeHtml = status === 'activo' ? '<span class="tag tag-success">Activo</span>'
                : status === 'expirado' ? '<span class="tag tag-danger">Expirado</span>'
                : '<span class="tag tag-default">Inactivo</span>';
            const isExpired = status === 'expirado';
            const toggleBtn = isExpired
                ? '<button class="btn btn-sm btn-secondary" disabled title="El cupón ha expirado"><i class="fas fa-clock"></i> Expirado</button>'
                : `<button class="btn btn-sm ${c.activo ? 'btn-warning' : 'btn-success'}" onclick="toggleCupon(${c.id_cupon}, ${!c.activo})"><i class="fas ${c.activo ? 'fa-times-circle' : 'fa-check-circle'}"></i> ${c.activo ? 'Desactivar' : 'Activar'}</button>`;
            return `<tr>
                <td>${c.id_cupon}</td>
                <td class="table-text-truncate" title="${escHtml(c.codigo)}"><strong style="text-transform:uppercase;color:var(--accent);">${escHtml(c.codigo)}</strong></td>
                <td><span class="tag tag-warning">${pct}%</span></td>
                <td>${c.usos_actual || 0}</td>
                <td>${c.usos_max || '∞'}</td>
                <td>${formatDate(c.fecha_inicio)}</td>
                <td>${formatDate(c.fecha_fin)}</td>
                <td>${badgeHtml}</td>
                <td>${toggleBtn}
                    <button class="btn btn-danger btn-sm" onclick="eliminarCupon(${c.id_cupon})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
}

async function toggleCupon(id, activo) {
    try {
        const cupones = await apiFetch(API.cupones);
        const c = cupones.find(x => x.id_cupon === id);
        if (!c) return;
        const isExpired = (c.status || (c.activo ? 'activo' : 'inactivo')) === 'expirado';
        if (activo && isExpired) {
            showAlert('No se puede activar un cupón expirado', 'error');
            return;
        }
        await apiFetch(API.cupones + '/' + id, {
            method: 'PUT',
            body: JSON.stringify({ ...c, activo }),
        });
        showAlert(activo ? 'Cupón activado' : 'Cupón desactivado', 'success');
        await cargarCupones();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

async function eliminarCupon(id) {
    const ok = await showConfirm('Eliminar cupón', '¿Eliminar este cupón permanentemente?');
    if (!ok) return;
    try {
        await apiFetch(API.cupones + '/' + id, { method: 'DELETE' });
        showAlert('Cupón eliminado', 'success');
        await cargarCupones();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.toggleCupon = toggleCupon;
window.eliminarCupon = eliminarCupon;
