let admins = [];

async function usuariosAdminInit() {
    console.log('[SPA] usuariosAdminInit invoked');
    const authReady = window.authPromise || Promise.resolve();
    await authReady;
    console.log('[SPA] usuariosAdminInit authReady done, calling cargarAdmins');
    await cargarAdmins();
    const btn = document.getElementById('agregarAdminBtn');
    console.log('[SPA] usuariosAdminInit btn=' + (btn ? 'found' : 'null'));
    if (btn) btn.addEventListener('click', () => abrirModalAdmin());
    console.log('[SPA] usuariosAdminInit EXIT');
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.usuariosAdminInit = usuariosAdminInit;
console.log('[DBG] usuariosAdminInit registered');
document.addEventListener('DOMContentLoaded', usuariosAdminInit);

async function cargarAdmins() {
    console.log('[SPA] cargarAdmins ENTER');
    const tbody = document.getElementById('adminsTableBody');
    const emptyState = document.getElementById('emptyState');
    console.log('[SPA] cargarAdmins tbody=' + (tbody ? 'OK' : 'NULL') + ' empty=' + (emptyState ? 'OK' : 'NULL'));
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;">Cargando...</td></tr>';

    try {
        admins = await apiFetch(API.adminUsers);
        if (admins.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';
        console.log('[SPA] cargarAdmins rendering ' + admins.length + ' admins');
        tbody.innerHTML = admins.map(a => `
            <tr>
                <td>${a.id_admin}</td>
                <td class="table-text-truncate" title="${escHtml(a.username)}"><strong>${escHtml(a.username)}</strong></td>
                <td class="table-text-truncate" title="${escHtml(a.carnet)}">${escHtml(a.carnet)}</td>
                <td>${formatDate(a.created_at)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarAdmin(${a.id_admin})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarAdmin(${a.id_admin})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.log('[SPA] cargarAdmins ERROR ' + e.message);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
    console.log('[SPA] cargarAdmins EXIT');
}

function abrirModalAdmin(data = null) {
    const modal = document.getElementById('adminModal');
    const title = document.getElementById('adminModalTitle');
    const body = document.getElementById('adminModalBody');
    const isEdit = data !== null;

    title.textContent = isEdit ? 'Editar Admin' : 'Nuevo Admin';
    body.innerHTML = `
        <form id="adminForm">
            <div class="form-group">
                <label>Usuario *</label>
                <input type="text" id="aUsername" value="${isEdit ? data.username : ''}" required>
            </div>
            <div class="form-group">
                <label>Carnet *</label>
                <input type="text" id="aCarnet" value="${isEdit ? data.carnet : ''}" required>
            </div>
            <div class="form-group">
                <label>Contraseña ${isEdit ? '(dejar vacío para mantener)' : '*'}</label>
                <input type="password" id="aPassword" ${isEdit ? '' : 'required'}>
            </div>
            <button type="submit" class="btn btn-success">${isEdit ? 'Actualizar' : 'Crear'} Admin</button>
        </form>
    `;

    modal.classList.add('active');

    document.getElementById('adminForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            username: document.getElementById('aUsername').value,
            carnet: document.getElementById('aCarnet').value,
            password: document.getElementById('aPassword').value,
        };

        try {
            if (isEdit) {
                if (!payload.password) delete payload.password;
                await apiFetch(API.adminUsers + '/' + data.id_admin, { method: 'PUT', body: JSON.stringify(payload) });
                showAlert('Admin actualizado', 'success');
            } else {
                await apiFetch(API.adminUsers, { method: 'POST', body: JSON.stringify(payload) });
                showAlert('Admin creado', 'success');
            }
            modal.classList.remove('active');
            await cargarAdmins();
        } catch (e) {
            showAlert('Error: ' + e.message, 'error');
        }
    });
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
}

function editarAdmin(id) {
    const a = admins.find(x => x.id_admin === id);
    if (a) abrirModalAdmin(a);
}

async function eliminarAdmin(id) {
    const ok = await showConfirm('Eliminar administrador', '¿Eliminar este administrador?');
    if (!ok) return;
    try {
        await apiFetch(API.adminUsers + '/' + id, { method: 'DELETE' });
        showAlert('Admin eliminado', 'success');
        await cargarAdmins();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.editarAdmin = editarAdmin;
window.eliminarAdmin = eliminarAdmin;
window.closeAdminModal = closeAdminModal;
