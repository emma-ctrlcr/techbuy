async function carruselInit() {
    await (window.authPromise || Promise.resolve());
    await cargarCarrusel();

    const uploadZone = document.getElementById('carruselUploadZone');
    const fileInput = document.getElementById('carruselImagen');
    const preview = document.getElementById('carruselUploadPreview');
    let currentFile = null;

    function updatePreview() {
        preview.innerHTML = '';
        if (!currentFile) return;
        const url = URL.createObjectURL(currentFile);
        const size = currentFile.size > 1024 * 1024 ? (currentFile.size / 1024 / 1024).toFixed(1) + ' MB' : (currentFile.size / 1024).toFixed(0) + ' KB';
        const div = document.createElement('div');
        div.className = 'upload-preview-item';
        div.innerHTML = `<img src="${url}" alt=""><div class="upload-preview-overlay"><button type="button" class="upload-preview-del" title="Eliminar"><i class="fas fa-times"></i></button></div><div class="upload-preview-size">${size}</div>`;
        div.querySelector('.upload-preview-del').addEventListener('click', (e) => {
            e.stopPropagation();
            currentFile = null;
            fileInput.value = '';
            fileInput.required = true;
            updatePreview();
        });
        preview.appendChild(div);
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const f = files[0];
            if (f.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) {
                currentFile = f;
                const dt = new DataTransfer();
                dt.items.add(f);
                fileInput.files = dt.files;
                fileInput.required = false;
                updatePreview();
            }
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            currentFile = fileInput.files[0];
            fileInput.required = false;
            updatePreview();
        }
    });

    document.getElementById('carruselForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

        try {
            const fd = new FormData();
            fd.append('imagen', currentFile || fileInput.files[0]);
            fd.append('titulo', document.getElementById('carruselTitulo').value);
            fd.append('subtitulo', document.getElementById('carruselSubtitulo').value);
            fd.append('btn_texto', document.getElementById('carruselBtnTexto').value);
            fd.append('btn_url', document.getElementById('carruselBtnUrl').value);
            fd.append('orden', document.getElementById('carruselOrden').value);
            fd.append('activo', document.getElementById('carruselActivo').checked);

            await apiFetch(API.carrusel, { method: 'POST', body: fd });
            showAlert('Imagen agregada al carrusel', 'success');
            e.target.reset();
            currentFile = null;
            updatePreview();
            document.getElementById('carruselActivo').checked = true;
            fileInput.required = true;
            await cargarCarrusel();
        } catch (e) {
            showAlert('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Agregar al Carrusel';
        }
    });
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.carruselInit = carruselInit;
document.addEventListener('DOMContentLoaded', carruselInit);

async function cargarCarrusel() {
    const tbody = document.getElementById('carruselTableBody');
    try {
        const imagenes = await apiFetch(API.carrusel);
        if (imagenes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;"><i class="fas fa-images" style="opacity:0.4;font-size:32px;display:block;margin-bottom:8px;"></i> No hay imágenes en el carrusel</td></tr>';
            return;
        }
        tbody.innerHTML = imagenes.map(img => `
            <tr>
                <td>${img.id_imagen}</td>
                <td><img src="${img.url}" class="carrusel-preview" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2270%22><rect fill=%22%23eee%22 width=%22120%22 height=%2270%22/><text x=%2220%22 y=%2240%22 fill=%22%23999%22 font-size=%2212%22>sin imagen</text></svg>'"></td>
                <td class="table-text-truncate" title="${escHtml(img.titulo || '')}">${escHtml(img.titulo) || '—'}</td>
                <td>${img.activo ? '<span class="tag tag-success"><i class="fas fa-check-circle"></i> Activo</span>' : '<span class="tag tag-danger"><i class="fas fa-times-circle"></i> Inactivo</span>'}</td>
                <td>${img.orden}</td>
                <td>${formatDateShort(img.created_at)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarCarrusel(${img.id_imagen})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarCarrusel(${img.id_imagen})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> Error: ${e.message}</td></tr>`;
    }
}

async function editarCarrusel(id) {
    try {
        const imagenes = await apiFetch(API.carrusel);
        const img = imagenes.find(i => i.id_imagen === id);
        if (!img) return;

        const modal = document.getElementById('editModal');
        const body = document.getElementById('editModalBody');

        body.innerHTML = `
            <form id="editCarruselForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="ecTitulo" value="${img.titulo || ''}">
                    </div>
                    <div class="form-group">
                        <label>Subtítulo</label>
                        <input type="text" id="ecSubtitulo" value="${img.subtitulo || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Texto Botón</label>
                        <input type="text" id="ecBtnTexto" value="${img.btn_texto || 'Ver Ofertas'}">
                    </div>
                    <div class="form-group">
                        <label>URL Botón</label>
                        <input type="text" id="ecBtnUrl" value="${img.btn_url || 'ofertas.html'}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Orden</label>
                        <input type="number" id="ecOrden" value="${img.orden || 0}">
                    </div>
                    <div class="form-group toggle-wrap" style="align-self:end;padding-bottom:4px;">
                        <input type="checkbox" id="ecActivo" ${img.activo ? 'checked' : ''}>
                        <label for="ecActivo" style="margin:0;font-weight:400;">Activo</label>
                    </div>
                </div>
                <button type="submit" class="btn btn-success"><i class="fas fa-save"></i> Guardar Cambios</button>
            </form>
        `;
        modal.classList.add('active');

        document.getElementById('editCarruselForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await apiFetch(API.carrusel + '/' + id, {
                    method: 'PUT',
                    body: JSON.stringify({
                        activo: document.getElementById('ecActivo').checked,
                        titulo: document.getElementById('ecTitulo').value,
                        subtitulo: document.getElementById('ecSubtitulo').value,
                        btn_texto: document.getElementById('ecBtnTexto').value,
                        btn_url: document.getElementById('ecBtnUrl').value,
                        orden: document.getElementById('ecOrden').value,
                    }),
                });
                modal.classList.remove('active');
                showAlert('Imagen actualizada', 'success');
                await cargarCarrusel();
            } catch (e) {
                showAlert('Error: ' + e.message, 'error');
            }
        });
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

async function eliminarCarrusel(id) {
    const ok = await showConfirm('Eliminar imagen', '¿Eliminar esta imagen del carrusel?');
    if (!ok) return;
    try {
        await apiFetch(API.carrusel + '/' + id, { method: 'DELETE' });
        showAlert('Imagen eliminada', 'success');
        await cargarCarrusel();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

window.editarCarrusel = editarCarrusel;
window.eliminarCarrusel = eliminarCarrusel;
window.closeEditModal = closeEditModal;