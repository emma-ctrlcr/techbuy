const API = {
    auth: '/api/admin/auth',
    admin: '/api/admin/admin',
    productos: '/api/admin/productos',
    ordenes: '/api/admin/ordenes',
    usuarios: '/api/admin/usuarios',
    adminUsers: '/api/admin/admin-users',
    alertas: '/api/admin/alertas',
    carrusel: '/api/admin/carrusel',
    cupones: '/api/admin/cupones',
    mensajes: '/api/admin/mensajes',
    categorias: '/api/admin/categorias',
};

const SIDEBAR_PAGES = [
    { file: 'productos-ingresar.html', icon: 'fa-box', label: 'Ingresar Producto' },
    { file: 'productos-buscar.html', icon: 'fa-search', label: 'Productos' },
    { file: 'ordenes.html', icon: 'fa-clipboard-list', label: 'Ordenes' },
    { file: 'usuarios-web.html', icon: 'fa-users', label: 'Usuarios Web' },
    { file: 'usuarios-admin.html', icon: 'fa-shield-alt', label: 'Usuarios Admin' },
    { file: 'carrusel.html', icon: 'fa-images', label: 'Carrusel' },
    { file: 'cupones.html', icon: 'fa-tags', label: 'Cupones' },
    { file: 'mensajes.html', icon: 'fa-envelope', label: 'Mensajes' },
];

let _resolveAuth;
window.authPromise = new Promise(resolve => { _resolveAuth = resolve; });

async function apiFetch(url, options = {}) {
    const defaults = { headers: { 'Content-Type': 'application/json' } };
    const merged = { ...defaults, ...options };
    if (options.body && options.body instanceof FormData) {
        delete merged.headers['Content-Type'];
    }
    const response = await fetch(url, merged);
    if (response.status === 401) {
        window.location.replace('/admin/401.html');
        throw new Error('No autorizado');
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error del servidor' }));
        throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
}

function getCurrentPage() {
    return window.location.pathname.split('/').pop();
}

function renderSidebar(activePage) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const current = activePage || getCurrentPage();
    const navHTML = SIDEBAR_PAGES.map(p => `
        <li class="nav-item">
            <a class="nav-link ${current === p.file ? 'active' : ''}" href="/admin/${p.file}" data-nav>
                <span class="icon"><i class="fas ${p.icon}"></i></span>
                <span>${p.label}${p.file === 'mensajes.html' ? ' <span class="msg-badge" id="mensajesBadge"></span>' : ''}</span>
            </a>
        </li>
    `).join('');
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo-box">
                <img src="/admin/img/logo-sidebar.png" alt="TechBuy" class="sidebar-logo-img" width="180" height="50">
            </div>
        </div>
        <ul class="nav-menu">${navHTML}</ul>
        <div class="sidebar-footer">
            <a class="nav-link store-link" id="viewStoreBtn" href="#">
                <span class="icon"><i class="fas fa-store"></i></span>
                <span>Ver tienda</span>
            </a>
        </div>
    `;
    const storeBtn = document.getElementById('viewStoreBtn');
    if (storeBtn) {
        storeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace('/store/pages/1.html');
        });
    }
}

function updateSidebarActive(page) {
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        const href = link.getAttribute('href').replace(/^\//, '').replace(/^admin\//, '');
        link.classList.toggle('active', href === page);
    });
}

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await apiFetch(API.auth + '/logout', { method: 'POST' });
            window.location.replace('/admin/login.html');
        });
    }
}

function setupStockAlert() {
    const adminInfo = document.querySelector('.admin-info');
    if (!adminInfo || document.getElementById('stockAlertBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'stockAlertBtn';
    btn.className = 'stock-alert-btn';
    btn.innerHTML = '<i class="fas fa-bell"></i><span class="stock-badge" id="stockBadge">0</span>';
    btn.title = 'Productos con stock bajo';
    btn.addEventListener('click', () => {
        const nav = window.adminNavigate;
        if (typeof nav === 'function') {
            nav('/admin/stock-bajo.html');
        } else {
            window.location.href = '/admin/stock-bajo.html';
        }
    });

    adminInfo.insertBefore(btn, adminInfo.firstChild);
}

function startBackgroundTasks() {
    checkStockAlerts();
    setInterval(checkStockAlerts, 30000);
    updateMensajesBadge();
}

async function checkStockAlerts() {
    const badge = document.getElementById('stockBadge');
    if (!badge) return;
    try {
        const data = await apiFetch(API.alertas + '/check?max_stock=3');
        const count = data.cantidad || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
        document.getElementById('stockAlertBtn').classList.toggle('has-alerts', count > 0);
    } catch {
        // silently ignore
    }
}

async function updateMensajesBadge() {
    const badge = document.getElementById('mensajesBadge');
    if (!badge) return;
    try {
        const data = await apiFetch(API.mensajes + '/count');
        const count = data.cantidad || 0;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
            badge.style.animation = 'none';
            badge.offsetHeight;
            badge.style.animation = 'badgePulse .4s ease';
        } else {
            badge.style.display = 'none';
            badge.textContent = '';
        }
    } catch {
        // silently ignore
    }
}

async function verifyAuth() {
    console.log('[SPA] verifyAuth start');
    const adminNameEl = document.getElementById('adminName');
    try {
        const data = await apiFetch(API.auth + '/verify');
        if (!data.loggedIn) {
            window.location.replace('/admin/401.html');
            return false;
        }
        document.body.classList.add('auth-ready');
        if (adminNameEl) {
            adminNameEl.textContent = data.username || 'Admin';
            if (data.carnet) adminNameEl.textContent += ` (${data.carnet})`;
        }
        console.log('[SPA] verifyAuth OK');
        return true;
    } catch {
        console.log('[SPA] verifyAuth FAIL redirecting');
        window.location.replace('/admin/401.html');
        return false;
    }
}

function formatPrice(val) {
    if (val == null || isNaN(val) || !isFinite(Number(val))) return '0.00';
    const num = Number(val);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val) {
    if (val == null) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '—';
        const parts = new Intl.DateTimeFormat('es-NI', {
            timeZone: 'America/Managua',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: true,
        }).formatToParts(d);
        const map = {};
        parts.forEach(p => { map[p.type] = p.value; });
        const raw = (map.dayPeriod || '').replace(/\s+/g, '').toLowerCase();
        const period = raw === 'am' || raw === 'a.m.' ? 'a.m.' : raw === 'pm' || raw === 'p.m.' ? 'p.m.' : raw;
        return `${map.day}/${map.month}/${map.year} \u00b7 ${map.hour}:${map.minute} ${period}`.trim();
    } catch {
        return '—';
    }
}

function formatDateShort(val) {
    if (val == null) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '—';
        const parts = new Intl.DateTimeFormat('es-NI', {
            timeZone: 'America/Managua',
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(d);
        const map = {};
        parts.forEach(p => { map[p.type] = p.value; });
        return `${map.day}/${map.month}/${map.year}`;
    } catch {
        return '—';
    }
}

function calcularPrecioFinal(originalId, descuentoId, finalId) {
    const originalEl = document.getElementById(originalId);
    const descEl = document.getElementById(descuentoId);
    const finalEl = document.getElementById(finalId);
    if (!originalEl || !finalEl) return;
    const original = parseFloat(originalEl.value) || 0;
    const desc = Math.max(0, parseInt(descEl?.value) || 0);
    if (desc > 0 && desc <= 100 && original > 0) {
        const precioFinal = original - (original * desc / 100);
        finalEl.value = precioFinal.toFixed(2);
    } else {
        finalEl.value = original > 0 ? original.toFixed(2) : '';
    }
}

function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.classList.toggle('sidebar-open');
    });
    if (overlay) {
        overlay.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
        });
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link[href]');
            if (link && window.innerWidth <= 1024) {
                document.body.classList.remove('sidebar-open');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[SPA] global DCL start');
    renderSidebar();
    setupSidebarToggle();
    setupLogout();
    setupStockAlert();
    await verifyAuth();
    console.log('[SPA] global _resolveAuth');
    _resolveAuth();
    startBackgroundTasks();
    console.log('[SPA] global DCL end');
});

document.addEventListener('input', (e) => {
    if (e.target.type === 'number' && e.target.min !== '') {
        const min = parseFloat(e.target.min);
        if (!isNaN(min) && e.target.value !== '' && parseFloat(e.target.value) < min) {
            e.target.value = min;
        }
    }
});
