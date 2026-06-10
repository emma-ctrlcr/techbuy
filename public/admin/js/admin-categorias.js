function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Admin Categorias (solo lectura) ──────────────────────── */
window.categoriasInit = async function() {
  await (window.authPromise || Promise.resolve());
  renderCatTable();
};

async function renderCatTable() {
  const tbody = document.getElementById('catTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

  try {
    const cats = await apiFetch(API.categorias);
    tbody.innerHTML = cats.map(c => `
      <tr>
        <td>${c.id_categoria}</td>
        <td><i class="fas ${c.icon || 'fa-box'}" style="font-size:20px;"></i></td>
        <td class="table-text-truncate" title="${escHtml(c.nombre)}"><strong>${escHtml(c.nombre)}</strong></td>
        <td class="table-text-truncate" title="${escHtml(c.key)}"><code>${escHtml(c.key)}</code></td>
        <td><span class="badge badge-info">${c.total_productos || 0}</span></td>
        <td>${c.orden ?? 0}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">Error: ${err.message}</td></tr>`;
  }
}
