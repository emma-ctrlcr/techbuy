async function ingresarProductoInit() {
    await (window.authPromise || Promise.resolve());
    const alertMsg = document.getElementById('alertMsg');
    const form = document.getElementById('productoForm');
    const categoriaSelect = document.getElementById('prodCategoria');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('prodImagenes');
    const preview = document.getElementById('uploadPreview');
    const countEl = document.getElementById('uploadCount');
    let selectedFiles = [];

    function imageCountText(n) {
        if (n === 0) return '0 imágenes seleccionadas';
        if (n === 1) return '1 imagen seleccionada';
        return n + ' imágenes seleccionadas';
    }

    function updateSubmitBtn() {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = selectedFiles.length === 0;
    }

    try {
        const cats = await apiFetch(API.categorias);
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.key;
            opt.textContent = c.nombre;
            categoriaSelect.appendChild(opt);
        });
    } catch (e) {
        showAlert('Error cargando categorías: ' + e.message, 'error');
    }

    function updatePreview() {
        preview.innerHTML = '';
        const total = selectedFiles.length;
        countEl.className = 'upload-count' + (total > 0 ? ' has-files' : '');
        countEl.innerHTML = '<i class="far fa-image"></i> <span>' + imageCountText(total) + '</span>';
        updateSubmitBtn();
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

    function addFiles(files) {
        const remaining = 5 - selectedFiles.length;
        const valid = [];
        for (const f of files) {
            if (valid.length >= remaining) break;
            if (!f.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) continue;
            valid.push(f);
        }
        selectedFiles = selectedFiles.concat(valid);
        updatePreview();
        syncInput();
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

    updateSubmitBtn();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showAlert('', '');

        const descripcion = document.getElementById('prodDescripcion').value.trim();
        if (!descripcion) {
            showAlert('La descripción del producto es requerida', 'error');
            return;
        }

        const precioVal = parseFloat(document.getElementById('prodPrecio').value);
        if (isNaN(precioVal) || precioVal <= 0) {
            showAlert('El precio original debe ser mayor a 0', 'error');
            return;
        }

        const stockVal = parseInt(document.getElementById('prodStock').value);
        if (isNaN(stockVal) || stockVal < 1) {
            showAlert('El stock mínimo permitido es 1', 'error');
            return;
        }

        if (selectedFiles.length === 0) {
            showAlert('Debes agregar al menos una imagen del producto.', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const fd = new FormData();
            fd.append('nombre', document.getElementById('prodNombre').value);
            fd.append('descripcion', document.getElementById('prodDescripcion').value);
            fd.append('precio_original', document.getElementById('prodPrecio').value);
            fd.append('descuento', document.getElementById('prodDescuento').value || '0');
            fd.append('stock', document.getElementById('prodStock').value);
            fd.append('categoria', categoriaSelect.value);
            fd.append('brand', document.getElementById('prodBrand').value);
            fd.append('badge', document.getElementById('prodBadge').value);
            fd.append('activo', document.getElementById('prodActivo').checked);

            for (const file of selectedFiles) {
                fd.append('imagenes', file);
            }

            const data = await apiFetch(API.productos, {
                method: 'POST',
                body: fd,
            });

            showAlert('Producto creado exitosamente (ID: ' + data.productoId + ')', 'success');
            form.reset();
            selectedFiles = [];
            updatePreview();
            syncInput();
            document.getElementById('prodActivo').checked = true;
        } catch (e) {
            showAlert('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = selectedFiles.length === 0;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
        }
    });
}

window.ingresarProductoInit = ingresarProductoInit;
document.addEventListener('DOMContentLoaded', ingresarProductoInit);

