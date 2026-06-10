const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?:\s[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/;

const params = new URLSearchParams(window.location.search);
const userId = params.get('id');
const isEdit = !!userId;

function validateNameInput(input, errorEl) {
    const val = input.value.trim();
    if (val === '') {
        errorEl.style.display = 'none';
        input.setCustomValidity('');
        return true;
    }
    if (!NAME_REGEX.test(val)) {
        errorEl.style.display = 'block';
        input.setCustomValidity(' ');
        return false;
    }
    errorEl.style.display = 'none';
    input.setCustomValidity('');
    return true;
}

function validateForm() {
    const nombreOk = validateNameInput(
        document.getElementById('uNombre'),
        document.getElementById('uNombreError')
    );
    const apellidoOk = validateNameInput(
        document.getElementById('uApellido'),
        document.getElementById('uApellidoError')
    );
    const btn = document.querySelector('button[type="submit"]');
    btn.disabled = !(nombreOk && apellidoOk);
    return nombreOk && apellidoOk;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('pageTitle').textContent = isEdit ? 'Editar Usuario #' + userId : 'Nuevo Usuario';
    document.querySelector('.page-header a').href = '/admin/usuarios-web.html';
    document.querySelector('.page-header a').innerHTML = '<i class=\"fas fa-arrow-left\"></i> Volver a Usuarios';

    document.getElementById('uNombre').addEventListener('input', validateForm);
    document.getElementById('uApellido').addEventListener('input', validateForm);

    if (!isEdit) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('usuarioForm').style.display = 'block';
        document.getElementById('uPassword').required = true;
        document.querySelector('.toggle-wrap').style.display = 'none';
        document.querySelector('button[type=\"submit\"]').className = 'btn btn-success'; document.querySelector('button[type=\"submit\"]').innerHTML = '<i class=\"fas fa-plus\"></i> Crear Usuario';
        document.getElementById('usuarioForm').onsubmit = async (e) => {
            e.preventDefault();
            if (!validateForm()) return;
            await crearUsuario();
        };
        return;
    }

    await (window.authPromise || Promise.resolve());
    await cargarUsuario(userId);
});

async function cargarUsuario(id) {
    try {
        const usuarios = await apiFetch(API.usuarios);
        const u = usuarios.find(x => x.id_usuario == id);
        if (!u) throw new Error('Usuario no encontrado');

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('usuarioForm').style.display = 'block';

        document.getElementById('uUsername').value = u.username || '';
        document.getElementById('uEmail').value = u.email || '';
        document.getElementById('uNombre').value = u.nombre || '';
        document.getElementById('uApellido').value = u.apellido || '';
        document.getElementById('uTel').value = u.tel || '';
        document.getElementById('uCity').value = u.city || '';
        document.getElementById('uAddress').value = u.address || '';
        document.getElementById('uActivo').checked = u.activo !== false;

        document.getElementById('usuarioForm').onsubmit = async (e) => {
            e.preventDefault();
            await guardarUsuario(id);
        };
    } catch (e) {
        showAlert('Error al cargar usuario: ' + e.message, 'error');
        document.getElementById('loadingState').querySelector('p').textContent = 'Error al cargar';
    }
}

async function guardarUsuario(id) {
    if (!validateForm()) return;

    const payload = {
        username: document.getElementById('uUsername').value,
        email: document.getElementById('uEmail').value,
        password: document.getElementById('uPassword').value,
        nombre: document.getElementById('uNombre').value.trim(),
        apellido: document.getElementById('uApellido').value.trim(),
        tel: document.getElementById('uTel').value,
        address: document.getElementById('uAddress').value,
        city: document.getElementById('uCity').value,
        activo: document.getElementById('uActivo').checked,
    };
    if (!payload.password) delete payload.password;

    try {
        await apiFetch(API.usuarios + '/' + id, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        showAlert('Usuario actualizado exitosamente', 'success');
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

async function crearUsuario() {
    if (!validateForm()) return;

    const payload = {
        username: document.getElementById('uUsername').value,
        email: document.getElementById('uEmail').value,
        password: document.getElementById('uPassword').value,
        nombre: document.getElementById('uNombre').value.trim(),
        apellido: document.getElementById('uApellido').value.trim(),
        tel: document.getElementById('uTel').value,
        address: document.getElementById('uAddress').value,
        city: document.getElementById('uCity').value,
    };

    try {
        await apiFetch(API.usuarios, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        showAlert('Usuario creado exitosamente', 'success');
        document.getElementById('usuarioForm').reset();
    } catch (e) {
        showAlert('Error: ' + e.message, 'error');
    }
}

