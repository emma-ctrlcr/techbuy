document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/admin/auth/verify')
        .then(r => r.json())
        .then(data => {
            if (data.loggedIn) window.location.replace('/admin/admin.html');
        })
        .catch(() => {});

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const carnet = document.getElementById('carnet').value;
        const errorDiv = document.getElementById('errorMessage');
        const loading = document.getElementById('loading');

        errorDiv.style.display = 'none';
        loading.style.display = 'block';

        try {
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, carnet })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.replace('/admin/admin.html');
            } else {
                loading.style.display = 'none';
                errorDiv.textContent = data.error || 'Error al iniciar sesión';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            loading.style.display = 'none';
            errorDiv.textContent = 'Error de conexión con el servidor';
            errorDiv.style.display = 'block';
        }
    });
});
