let usuarios = [];

async function usuariosWebInit() {
    await (window.authPromise || Promise.resolve());
    await cargarUsuarios();

    document.getElementById('buscarBtn').addEventListener('click', filtrarUsuarios);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') filtrarUsuarios();
    });
    document.getElementById('limpiarBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        renderUsuarios();
    });
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.usuariosWebInit = usuariosWebInit;
document.addEventListener('DOMContentLoaded', usuariosWebInit);

async function cargarUsuarios() {
    const tbody = document.getElementById('usuariosTableBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;">Cargando...</td></tr>';
    try {
        usuarios = await apiFetch(API.usuarios);
        renderUsuarios();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
}

function renderUsuarios() {
    const tbody = document.getElementById('usuariosTableBody');
    const emptyState = document.getElementById('emptyState');
    if (usuarios.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.id_usuario}</td>
            <td class="table-text-truncate" title="${escHtml(u.username || '')}"><strong>${escHtml(u.username) || '—'}</strong></td>
            <td class="table-text-truncate" title="${escHtml(u.email || '')}">${escHtml(u.email) || '—'}</td>
            <td class="table-text-truncate" title="${escHtml((u.nombre || '') + ' ' + (u.apellido || ''))}">${(u.nombre || '—') + (u.apellido ? ' ' + u.apellido : '')}</td>
            <td>${u.tel || '—'}</td>
            <td>${u.city || '—'}</td>
            <td>${u.activo !== false ? '<span class="tag tag-success">Activo</span>' : '<span class="tag tag-danger">Inactivo</span>'}</td>
            <td>${formatDateShort(u.created_at)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editarUsuario(${u.id_usuario})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="eliminarUsuario(${u.id_usuario})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

function filtrarUsuarios() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    if (!q) { renderUsuarios(); return; }
    const filtered = usuarios.filter(u =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        String(u.id_usuario).includes(q)
    );
    const tbody = document.getElementById('usuariosTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;">Sin resultados</td></tr>';
        return;
    }
    const temp = usuarios;
    usuarios = filtered;
    renderUsuarios();
    usuarios = temp;
}

function editarUsuario(id) {
    window.location.href = '/admin/usuario-editar.html?id=' + id;
}

async function eliminarUsuario(id) {
    const ok = await showConfirm('Eliminar usuario', '¿Eliminar este usuario?');
    if (!ok) return;
    try {
        await apiFetch(API.usuarios + '/' + id, { method: 'DELETE' });
        showAlert('Usuario eliminado', 'success');
        await cargarUsuarios();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.editarUsuario = editarUsuario;
window.eliminarUsuario = eliminarUsuario;
