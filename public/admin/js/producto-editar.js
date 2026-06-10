let currentProductId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        showAlert('No se especificó un producto', 'error');
        document.getElementById('loadingState').querySelector('p').textContent = 'ID de producto no válido';
        return;
    }
    currentProductId = id;
    document.getElementById('pageTitle').textContent = 'Editar Producto #' + id;
    await (window.authPromise || Promise.resolve());
    await cargarProducto(id);
});

const uploadZone = document.getElementById('editUploadZone');
const fileInput = document.getElementById('editImagenes');
const preview = document.getElementById('editUploadPreview');
const countEl = document.getElementById('editUploadCount');
let selectedFiles = [];

function updatePreview() {
    preview.innerHTML = '';
    const total = selectedFiles.length;
    countEl.className = 'upload-count' + (total > 0 ? ' has-files' : '');
    countEl.innerHTML = '<i class="far fa-image"></i> <span>' + total + ' de 5 archivos</span>';
    selectedFiles.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const size = file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : (file.size / 1024).toFixed(0) + ' KB';
        const div = document.createElement('div');
        div.className = 'upload-preview-item';
        div.style.animationDelay = (i * 0.06) + 's';
        div.innerHTML = `<img src="${url}" alt=""><div class="upload-preview-overlay"><button type="button" class="upload-preview-del" data-index="${i}" title="Eliminar"><i class="fas fa-times"></i></button></div><div class="upload-preview-size">${size}</div>`;
        div.querySelector('.upload-preview-del').addEventListener('click', (e) => {
            e.stopPropagation();
            selectedFiles.splice(i, 1);
            updatePreview();
            syncInput();
        });
        preview.appendChild(div);
    });
}

function syncInput() {
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    fileInput.files = dt.files;
}

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
});

function addFiles(files) {
    const remaining = 5 - selectedFiles.length;
    for (const f of files) {
        if (selectedFiles.length >= 5) break;
        if (!f.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) continue;
        selectedFiles.push(f);
    }
    updatePreview();
    syncInput();
}

async function cargarProducto(id) {
    try {
        const [p, cats] = await Promise.all([
            apiFetch(API.productos + '/' + id),
            apiFetch(API.categorias),
        ]);

        console.log('[cargarProducto] API response:', JSON.stringify({ precio: p.precio, precio_anterior: p.precio_anterior, descuento: p.descuento }));

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('editForm').style.display = 'block';

        document.getElementById('editNombre').value = p.nombre || '';
        document.getElementById('editBrand').value = p.brand || '';
        document.getElementById('editDescripcion').value = p.descripcion || '';

        const origVal = p.precio_anterior != null ? p.precio_anterior : (p.precio != null ? p.precio : '');
        const finalVal = p.precio != null ? p.precio : '';
        console.log('[cargarProducto] asignando editPrecio =', origVal, '| editPrecioFinal =', finalVal);

        document.getElementById('editPrecio').value = origVal;
        document.getElementById('editPrecioFinal').value = finalVal;
        document.getElementById('editDescuento').value = p.descuento != null ? p.descuento : 0;
        document.getElementById('editStock').value = p.stock || '';
        document.getElementById('editActivo').checked = p.activo !== false;

        const catSelect = document.getElementById('editCategoria');
        catSelect.innerHTML = cats.map(c =>
            `<option value="${c.key}" ${(c.key === p.categoria_key || c.nombre === p.categoria_nombre) ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        document.getElementById('editBadge').value = p.badge || '';

        const imgContainer = document.getElementById('imagenesActuales');
        const imgGrid = document.getElementById('imagenesGrid');
        if (p.imagenes && p.imagenes.length > 0) {
            imgContainer.style.display = 'block';
            imgGrid.innerHTML = p.imagenes.map(img => `
                <div class="existing-item">
                    <img src="${img.url}" alt="">
                    <div class="existing-overlay"><button type="button" class="existing-del" onclick="eliminarImagen(${p.id_producto}, ${img.id_imagen})" title="Eliminar"><i class="fas fa-trash-alt"></i></button></div>
                </div>
            `).join('');
        } else {
            imgContainer.style.display = 'none';
            imgGrid.innerHTML = '';
        }

        document.getElementById('editForm').onsubmit = async (e) => {
            e.preventDefault();
            await guardarCambios(id);
        };
    } catch (e) {
        showAlert('Error al cargar producto: ' + e.message, 'error');
        document.getElementById('loadingState').querySelector('p').textContent = 'Error al cargar';
    }
}

async function guardarCambios(id) {
    const origEl = document.getElementById('editPrecio');
    const descEl = document.getElementById('editDescuento');
    const finalEl = document.getElementById('editPrecioFinal');

    // Snapshot: guardar valores actuales por si algo falla
    const snapshot = {
        precio: origEl?.value,
        descuento: descEl?.value,
        precioFinal: finalEl?.value,
        nombre: document.getElementById('editNombre')?.value,
        descripcion: document.getElementById('editDescripcion')?.value,
        stock: document.getElementById('editStock')?.value,
        brand: document.getElementById('editBrand')?.value,
        badge: document.getElementById('editBadge')?.value,
        categoria: document.getElementById('editCategoria')?.value,
        activo: document.getElementById('editActivo')?.checked,
    };

    console.log('[guardarCambios] SNAPSHOT inicial:', JSON.stringify(snapshot));

    const stockVal = parseInt(snapshot.stock);
    if (isNaN(stockVal) || stockVal < 1) {
        console.warn('[guardarCambios] Stock inválido:', snapshot.stock);
        showAlert('El stock mínimo permitido es 1', 'error');
        return;
    }

    if (!origEl || origEl.value === '' || parseFloat(origEl.value) <= 0) {
        console.warn('[guardarCambios] Precio original vacío o inválido');
        showAlert('El precio original es requerido', 'error');
        return;
    }

    calcularPrecioFinal('editPrecio', 'editDescuento', 'editPrecioFinal');
    console.log('[guardarCambios] después de calcularPrecioFinal - editPrecio:', origEl.value, '| editPrecioFinal:', finalEl?.value);

    const payload = {
        nombre: snapshot.nombre,
        descripcion: snapshot.descripcion,
        precio_original: origEl.value,
        descuento: descEl?.value || 0,
        stock: snapshot.stock,
        categoria: snapshot.categoria,
        brand: snapshot.brand,
        badge: snapshot.badge,
        activo: snapshot.activo,
    };
    console.log('[guardarCambios] payload enviado:', JSON.stringify(payload));

    try {
        const putResp = await apiFetch(API.productos + '/' + id, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        console.log('[guardarCambios] PUT response:', JSON.stringify(putResp));

        if (selectedFiles.length > 0) {
            const fd = new FormData();
            for (const f of selectedFiles) fd.append('imagenes', f);
            await apiFetch(API.productos + '/' + id + '/imagenes', { method: 'POST', body: fd });
            selectedFiles = [];
            updatePreview();
            syncInput();
        }

        showAlert('Producto actualizado exitosamente', 'success');

        // Recargar desde API para reflejar valores guardados
        try {
            await cargarProducto(id);
            console.log('[guardarCambios] después de cargarProducto - editPrecio:', document.getElementById('editPrecio')?.value, '| editPrecioFinal:', document.getElementById('editPrecioFinal')?.value);
        } catch (loadErr) {
            console.warn('[guardarCambios] cargarProducto falló, restaurando snapshot');
            // Restaurar snapshot si cargarProducto falla
            if (origEl) origEl.value = snapshot.precio;
            if (finalEl) finalEl.value = snapshot.precioFinal;
            if (descEl) descEl.value = snapshot.descuento;
        }
    } catch (e) {
        console.error('[guardarCambios] ERROR:', e.message);
        showAlert('Error: ' + e.message, 'error');
    }
}

async function eliminarImagen(productoId, imgId) {
    const ok = await showConfirm('Eliminar imagen', '¿Eliminar esta imagen?');
    if (!ok) return;
    try {
        await apiFetch(API.productos + '/' + productoId + '/imagenes/' + imgId, { method: 'DELETE' });
        showAlert('Imagen eliminada', 'success');
        await cargarProducto(productoId);
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.eliminarImagen = eliminarImagen;