async function mensajesInit() {
    await (window.authPromise || Promise.resolve());
    await cargarMensajes();
}

window.mensajesInit = mensajesInit;
document.addEventListener('DOMContentLoaded', mensajesInit);

async function cargarMensajes() {
    const tbody = document.getElementById('mensajesTableBody');
    try {
        const mensajes = await apiFetch(API.mensajes);
        if (mensajes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;">No hay mensajes</td></tr>';
            return;
        }
        tbody.innerHTML = mensajes.map(m => `
            <tr style="${!m.leido ? 'font-weight:600;background:#fff8f0;' : ''}cursor:pointer;" onclick="verMensaje(${m.id_contacto})">
                <td class="col-id">${m.id_contacto}</td>
                <td class="col-nombre" title="${escHtml(m.nombre)}"><span class="cell-text">${escHtml(m.nombre)}</span></td>
                <td class="col-email" title="${escHtml(m.email)}"><a href="mailto:${m.email}" class="cell-link">${escHtml(m.email)}</a></td>
                <td class="col-telefono">${m.telefono || '—'}</td>
                <td class="col-asunto" title="${escHtml(m.asunto || '')}"><span class="cell-text">${escHtml(m.asunto) || '—'}</span></td>
                <td class="col-mensaje" title="${escHtml(m.mensaje)}"><span class="cell-text">${escHtml(m.mensaje)}</span></td>
                <td class="col-leido">${m.leido ? '<span class="tag tag-success">Leído</span>' : '<span class="tag tag-warning">Nuevo</span>'}</td>
                <td class="col-respondido">${m.respondido ? '<span class="tag tag-success">Sí</span>' : '<span class="tag tag-default">No</span>'}</td>
                <td class="col-fecha">${formatDate(m.created_at)}</td>
                <td class="col-acciones">
                    <a href="/admin/vermensajes.html?id=${m.id_contacto}" class="btn btn-primary btn-sm" title="Ver mensaje completo"><i class="fas fa-external-link-alt"></i></a>
                    <button class="btn btn-success btn-sm" onclick="marcarRespondido(${m.id_contacto})" title="Marcar respondido"><i class="fas fa-check-double"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();eliminarMensaje(${m.id_contacto})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function verMensaje(id) {
    try {
        const mensajes = await apiFetch(API.mensajes);
        const m = mensajes.find(x => x.id_contacto === id);
        if (!m) return;

        if (!m.leido) {
            await apiFetch(API.mensajes + '/' + id + '/leido', { method: 'PUT' });
            await cargarMensajes();
        }

        const modal = document.getElementById('detalleModal');
        const body = document.getElementById('detalleModalBody');
        if (!modal || !body) {
            console.error('[Mensajes] Modal no encontrado en el DOM');
            return;
        }

        body.innerHTML = `
            <div style="margin-bottom:16px;overflow-wrap:break-word;word-break:break-word;">
                <p><strong>De:</strong> ${escHtml(m.nombre)} (${escHtml(m.email)})</p>
                <p><strong>Teléfono:</strong> ${escHtml(m.telefono) || '—'}</p>
                <p><strong>Asunto:</strong> ${escHtml(m.asunto) || '—'}</p>
                <p><strong>Fecha:</strong> ${formatDate(m.created_at)}</p>
            </div>
            <hr style="margin:12px 0;">
            <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:12px 0;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;line-height:1.6;">
                ${escHtml(m.mensaje)}
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;">
                <a href="mailto:${m.email}?subject=Re: ${m.asunto || 'Consulta TechBuy'}" class="btn btn-success" target="_blank"><i class="fas fa-reply"></i> Responder por Email</a>
                <button class="btn btn-success" onclick="marcarRespondido(${m.id_contacto})"><i class="fas fa-check-double"></i> Marcar Respondido</button>
            </div>
        `;

        modal.classList.add('active');
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

async function marcarRespondido(id) {
    try {
        await apiFetch(API.mensajes + '/' + id + '/respondido', { method: 'PUT' });
        showAlert('Marcado como respondido', 'success');
        document.getElementById('detalleModal').classList.remove('active');
        await cargarMensajes();
        if (typeof updateMensajesBadge === 'function') updateMensajesBadge();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

function closeDetalleModal() {
    document.getElementById('detalleModal').classList.remove('active');
}

async function eliminarMensaje(id) {
    const ok = await showConfirm('Eliminar mensaje', '¿Eliminar este mensaje?');
    if (!ok) return;
    try {
        await apiFetch(API.mensajes + '/' + id, { method: 'DELETE' });
        showAlert('Mensaje eliminado', 'success');
        await cargarMensajes();
        if (typeof updateMensajesBadge === 'function') updateMensajesBadge();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

function agregarFilaMensaje(m) {
    const tbody = document.getElementById('mensajesTableBody');
    if (!tbody) return;

    const emptyRow = tbody.querySelector('tr td[colspan]');
    if (emptyRow) tbody.innerHTML = '';

    const tr = document.createElement('tr');
    tr.style.cssText = 'font-weight:600;background:#fff8f0;cursor:pointer;animation:fadeInRow 0.4s ease;';
    tr.onclick = () => verMensaje(m.id_contacto);
    tr.innerHTML = `
        <td class="col-id">${m.id_contacto}</td>
        <td class="col-nombre" title="${escHtml(m.nombre)}"><span class="cell-text">${escHtml(m.nombre)}</span></td>
        <td class="col-email" title="${escHtml(m.email)}"><a href="mailto:${m.email}" class="cell-link">${escHtml(m.email)}</a></td>
        <td class="col-telefono">${escHtml(m.telefono) || '—'}</td>
        <td class="col-asunto" title="${escHtml(m.asunto || '')}"><span class="cell-text">${escHtml(m.asunto) || '—'}</span></td>
        <td class="col-mensaje" title="${escHtml(m.mensaje)}"><span class="cell-text">${escHtml(m.mensaje)}</span></td>
        <td class="col-leido"><span class="tag tag-warning">Nuevo</span></td>
        <td class="col-respondido"><span class="tag tag-default">No</span></td>
        <td class="col-fecha">${formatDate(m.created_at)}</td>
        <td class="col-acciones">
            <a href="/admin/vermensajes.html?id=${m.id_contacto}" class="btn btn-primary btn-sm" title="Ver mensaje completo"><i class="fas fa-external-link-alt"></i></a>
            <button class="btn btn-success btn-sm" onclick="marcarRespondido(${m.id_contacto})" title="Marcar respondido"><i class="fas fa-check-double"></i></button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();eliminarMensaje(${m.id_contacto})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </td>`;
    tbody.insertBefore(tr, tbody.firstChild);
}

window.verMensaje = verMensaje;
window.eliminarMensaje = eliminarMensaje;
window.marcarRespondido = marcarRespondido;
window.closeDetalleModal = closeDetalleModal;
window.agregarFilaMensaje = agregarFilaMensaje;
