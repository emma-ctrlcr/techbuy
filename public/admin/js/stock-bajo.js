async function stockBajoInit() {
    await (window.authPromise || Promise.resolve());
    const tbody = document.getElementById('stockTableBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">Cargando...</td></tr>';

    try {
        const data = await apiFetch(API.alertas + '?max_stock=3');
        if (data.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        tbody.innerHTML = data.map(p => {
            const critical = p.stock === 0;
            const warning = p.stock > 0 && p.stock <= 3;
            const rowClass = critical ? 'stock-critical' : (warning ? 'stock-warning-row' : '');
            const badgeClass = critical ? 'stock-badge-critical' : 'stock-badge-warning';
            const badgeIcon = critical ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
            const imgUrl = p.imagen || '';
            const precio = formatPrice(p.precio);
            const precioOrig = p.precio_anterior > 0 ? formatPrice(p.precio_anterior) : null;
            const hasDiscount = p.descuento > 0 && precioOrig != null;
            return `<tr class="${rowClass}">
                <td>${p.id_producto}</td>
                <td>${imgUrl ? `<img src="${imgUrl}" class="img-thumb" onerror="this.style.display='none'">` : '—'}</td>
                <td class="table-text-truncate" title="${escHtml(p.nombre)}"><strong>${escHtml(p.nombre)}</strong></td>
                <td class="table-text-truncate" title="${escHtml(p.brand || '')}">${escHtml(p.brand) || '—'}</td>
                <td><span class="${badgeClass}"><i class="fas ${badgeIcon}"></i> ${p.stock}</span></td>
                <td>${hasDiscount ? `<span style="text-decoration:line-through;color:#999;">C$${precioOrig}</span> <strong style="color:var(--accent);">C$${precio}</strong>` : `<strong>C$${precio}</strong>`}</td>
                <td><span class="tag tag-info">${p.categoria_nombre || '—'}</span></td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id_producto})" title="Editar"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`;
        }).join('');
        checkStockAlerts();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
}

function editarProducto(id) {
    window.location.href = '/admin/producto-editar.html?id=' + id;
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.stockBajoInit = stockBajoInit;
document.addEventListener('DOMContentLoaded', stockBajoInit);