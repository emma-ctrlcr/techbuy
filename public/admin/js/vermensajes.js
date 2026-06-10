document.addEventListener('DOMContentLoaded', () => window.verMensajesInit());
window.verMensajesInit = async function() {
  await (window.authPromise || Promise.resolve());
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('msgContainer').innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#999;">
        <i class="fas fa-envelope-open-text" style="font-size:48px;color:#ccc;margin-bottom:12px;"></i>
        <p>No se especificó un mensaje.</p>
        <a href="/admin/mensajes.html" class="btn btn-secondary" style="margin-top:16px;display:inline-block;">← Volver a mensajes</a>
      </div>`;
    return;
  }

  try {
    const mensajes = await apiFetch(API.mensajes);
    const m = mensajes.find(x => x.id_contacto == id);

    if (!m) {
      document.getElementById('msgContainer').innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#999;">
          <i class="fas fa-exclamation-circle" style="font-size:48px;color:#ccc;margin-bottom:12px;"></i>
          <p>Mensaje no encontrado.</p>
<a href="/admin/mensajes.html" class="btn btn-secondary" style="margin-top:16px;display:inline-block;">← Volver a mensajes</a>
        </div>`;
      return;
    }

    if (!m.leido) {
      await apiFetch(API.mensajes + '/' + id + '/leido', { method: 'PUT' });
      if (typeof updateMensajesBadge === 'function') updateMensajesBadge();
    }

    document.getElementById('msgContainer').innerHTML = `
      <a href="/admin/mensajes.html" style="display:inline-flex;align-items:center;gap:6px;color:var(--primary);text-decoration:none;font-size:14px;margin-bottom:20px;">
        <i class="fas fa-arrow-left"></i> Volver a mensajes
      </a>

      <div class="card">
        <div style="padding:24px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div>
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Remitente</div>
              <div class="sender-name" style="font-size:16px;font-weight:700;">${escHtml(m.nombre)}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Email</div>
              <div class="message-detail-value" style="font-size:14px;"><a href="mailto:${m.email}">${escHtml(m.email)}</a></div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Teléfono</div>
              <div style="font-size:14px;">${escHtml(m.telefono) || '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Asunto</div>
              <div class="message-detail-value" style="font-size:14px;">${escHtml(m.asunto) || '—'}</div>
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Fecha</div>
          <div style="font-size:13px;color:#666;margin-bottom:20px;">${formatDate(m.created_at)}</div>

          <hr style="border:none;border-top:1px solid #e0e4f0;margin:16px 0;">

          <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Mensaje</div>
          <div style="background:#f8f9fa;padding:20px 20px 20px 24px;border-radius:8px;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;overflow:hidden;line-height:1.7;font-size:14px;max-width:100%;border-left:4px solid var(--accent,#00AEEF);font-family:'Inter',sans-serif;">${escHtml(m.mensaje)}</div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid #e0e4f0;">
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${encodeURIComponent('Respuesta de TechBuy - ' + (m.asunto || 'Consulta'))}"
               target="_blank"
               title="Responder por Gmail"
               class="btn btn-success">
              <i class="fas fa-reply"></i>
              Responder por Email
              <i class="fas fa-external-link-alt" style="font-size:11px;opacity:.7;"></i>
            </a>
          </div>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('msgContainer').innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--danger);">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:12px;"></i>
        <p>Error: ${escHtml(e.message)}</p>
        <a href="/admin/mensajes.html" class="btn btn-secondary" style="margin-top:16px;display:inline-block;">← Volver a mensajes</a>
      </div>`;
  }
};

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
