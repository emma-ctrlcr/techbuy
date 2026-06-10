let productos = [];
let suggTimeout = null;
let suggAbort = null;
let suggListenerAttached = false;

async function buscarProductosInit() {
    await (window.authPromise || Promise.resolve());
    const alertMsg = document.getElementById('alertMsg');
    const categoriaFilter = document.getElementById('categoriaFilter');
    const searchInput = document.getElementById('searchInput');

    try {
        const cats = await apiFetch(API.categorias);
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.key;
            opt.textContent = c.nombre;
            categoriaFilter.appendChild(opt);
        });
    } catch (e) {
        showAlert('Error cargando categorías', 'error');
    }

    document.getElementById('buscarBtn').addEventListener('click', buscarProductos);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            closeSuggestions();
            buscarProductos();
        }
    });
    searchInput.addEventListener('input', onSearchInput);

    if (!suggListenerAttached) {
        suggListenerAttached = true;
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrap')) closeSuggestions();
        });
    }

    await buscarProductos();
}

function onSearchInput() {
    const q = document.getElementById('searchInput').value.trim();
    clearTimeout(suggTimeout);
    if (suggAbort) { suggAbort.abort(); suggAbort = null; }
    if (q.length < 2) { closeSuggestions(); return; }
    suggTimeout = setTimeout(() => fetchSuggestions(q), 300);
}

async function fetchSuggestions(q) {
    const container = document.getElementById('searchSuggestions');
    suggAbort = new AbortController();
    container.innerHTML = '<div class="suggestion-loading"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';
    container.classList.add('active');

    try {
        const params = new URLSearchParams();
        params.set('search', q);
        params.set('limit', 8);
        const data = await apiFetch(API.productos + '?' + params.toString(), { signal: suggAbort.signal });
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="suggestion-no-results">Sin resultados para "<strong>' + escHtml(q) + '</strong>"</div>';
            return;
        }
        container.innerHTML = data.map(p => {
            const imgUrl = p.imagenes && p.imagenes.length > 0 ? p.imagenes[0].url : '';
            const precio = formatPrice(p.precio);
            const precioOrig = p.precio_anterior != null && p.precio_anterior > 0 ? formatPrice(p.precio_anterior) : null;
            const hasDiscount = p.descuento > 0 && precioOrig != null;
            return '<div class="suggestion-item" data-id="' + p.id_producto + '">' +
                (imgUrl ? '<img class="suggestion-img" src="' + imgUrl + '" onerror="this.style.display=\'none\'">' : '<div class="suggestion-img" style="display:flex;align-items:center;justify-content:center;color:#cbd5e1;"><i class="fas fa-box fa-lg"></i></div>') +
                '<div class="suggestion-info">' +
                '<div class="suggestion-name">' + escHtml(p.nombre) + '</div>' +
                '<div class="suggestion-meta">' +
                '<span>ID ' + p.id_producto + '</span>' +
                (p.brand ? '<span>' + escHtml(p.brand) + '</span>' : '') +
                '<span class="' + (p.stock <= 10 ? 'tag-danger' : '') + '">Stock: ' + p.stock + '</span>' +
                '</div></div>' +
                '<div class="suggestion-price">' +
                (hasDiscount ? '<span class="old">C$' + precioOrig + '</span><span>C$' + precio + '</span>' : '<span>C$' + precio + '</span>') +
                '</div></div>';
        }).join('');

        container.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('searchInput').value = el.querySelector('.suggestion-name').textContent;
                closeSuggestions();
                buscarProductos();
            });
        });
    } catch (e) {
        if (e.name !== 'AbortError') {
            container.innerHTML = '<div class="suggestion-no-results">Error al buscar</div>';
        }
    }
}

function closeSuggestions() {
    clearTimeout(suggTimeout);
    const el = document.getElementById('searchSuggestions');
    if (el) el.classList.remove('active');
}

function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.buscarProductosInit = buscarProductosInit;
document.addEventListener('DOMContentLoaded', buscarProductosInit);

async function buscarProductos() {
    const search = document.getElementById('searchInput').value;
    const categoria = document.getElementById('categoriaFilter').value;
    const descuento = document.getElementById('descuentoFilter').value;
    const tbody = document.getElementById('productosTableBody');
    const emptyState = document.getElementById('emptyState');

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;">Cargando...</td></tr>';

    try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (categoria !== 'todos') params.set('categoria', categoria);
        if (descuento !== 'todos') params.set('descuento', descuento);

        productos = await apiFetch(API.productos + '?' + params.toString());
        renderProductos();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--danger);">Error: ${e.message}</td></tr>`;
    }
}

function renderProductos() {
    const tbody = document.getElementById('productosTableBody');
    const emptyState = document.getElementById('emptyState');

    if (productos.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = productos.map(p => {
        const imgUrl = p.imagenes && p.imagenes.length > 0 ? p.imagenes[0].url : '';
        const precio = formatPrice(p.precio);
        const precioOrig = p.precio_anterior != null && p.precio_anterior > 0 ? formatPrice(p.precio_anterior) : null;
        const hasDiscount = p.descuento > 0 && precioOrig != null;
        return `<tr>
            <td>${p.id_producto}</td>
            <td>${imgUrl ? `<img src="${imgUrl}" class="img-preview" onerror="this.style.display='none'">` : '—'}</td>
            <td class="table-text-truncate" title="${escHtml(p.nombre)}"><strong>${escHtml(p.nombre)}</strong></td>
            <td class="table-text-truncate" title="${escHtml(p.brand || '')}">${escHtml(p.brand) || '—'}</td>
            <td>
                ${hasDiscount ? `<span style="text-decoration:line-through;color:#999;">C$${precioOrig}</span> <strong style="color:var(--accent);">C$${precio}</strong>` : `<strong>C$${precio}</strong>`}
            </td>
            <td>${p.descuento > 0 ? `<span class="tag tag-warning">${p.descuento}%</span>` : '—'}</td>
            <td>${p.stock <= 100 ? `<span class="tag ${p.stock <= 10 ? 'tag-danger' : 'tag-warning'}">${p.stock}</span>` : p.stock}</td>
            <td><span class="tag tag-info">${p.categoria_nombre || '—'}</span></td>
            <td>${p.activo !== false ? '<span class="tag tag-success">Activo</span>' : '<span class="tag tag-danger">Inactivo</span>'}</td>
            <td style="text-align:center;white-space:nowrap;">
                <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id_producto})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id_producto})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function editarProducto(id) {
    window.location.href = '/admin/producto-editar.html?id=' + id;
}

async function eliminarProducto(id) {
    const ok = await showConfirm('Eliminar producto', '¿Estás seguro de eliminar este producto?');
    if (!ok) return;
    try {
        await apiFetch(API.productos + '/' + id, { method: 'DELETE' });
        showAlert('Producto eliminado', 'success');
        await buscarProductos();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
