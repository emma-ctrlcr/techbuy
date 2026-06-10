function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const adminSocket = io(window.location.origin + '/admin', {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

let unreadCount = 0;

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

function updateBadgeUI() {
    const badge = document.getElementById('mensajesBadge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-flex';
        badge.style.animation = 'none';
        badge.offsetHeight;
        badge.style.animation = 'badgePulse .4s ease';
    } else {
        badge.style.display = 'none';
        badge.textContent = '';
    }
}

async function fetchUnreadCount() {
    try {
        const res = await fetch('/api/admin/mensajes/count');
        if (!res.ok) return;
        const data = await res.json();
        unreadCount = data.cantidad || 0;
        updateBadgeUI();
    } catch {}
}

function triggerReloadMensajes() {
    if (typeof cargarMensajes === 'function') {
        cargarMensajes();
    }
}

function getCurrentPage() {
    const path = window.location.pathname.split('/').pop();
    if (path) return path;
    const hash = window.location.hash.replace('#', '');
    return hash || '';
}

setInterval(() => {
    fetchUnreadCount();
    const page = getCurrentPage();
    if (page === 'mensajes.html') {
        triggerReloadMensajes();
    }
}, 15000);

adminSocket.on('connect', () => {
    console.log('[AdminSocket] Conectado /admin, ID:', adminSocket.id, 'Transporte:', adminSocket.io.engine.transport.name);
});

adminSocket.on('connect_error', (err) => {
    console.error('[AdminSocket] Error conexión:', err.message, err.description);
});

adminSocket.on('disconnect', (reason) => {
    console.log('[AdminSocket] Desconectado:', reason);
});

adminSocket.on('nuevoMensaje', (msg) => {
    console.log('[AdminSocket] nuevoMensaje RECIBIDO:', msg.id_contacto, msg.nombre);
    fetchUnreadCount();
    playNotificationSound();
    Swal.fire({
        icon: 'info',
        title: 'Nuevo mensaje',
        html: `<strong>${escHtml(msg.nombre || 'Usuario')}</strong><br>${msg.mensaje ? escHtml(msg.mensaje.substring(0, 80)) + '...' : ''}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', () => Swal.stopTimer());
            toast.addEventListener('mouseleave', () => Swal.resumeTimer());
        },
    });
    const page = getCurrentPage();
    if (page === 'mensajes.html') {
        if (typeof agregarFilaMensaje === 'function') {
            agregarFilaMensaje(msg);
        } else {
            triggerReloadMensajes();
        }
    }
});

adminSocket.on('message:new', (data) => {
    console.log('[AdminSocket] message:new recibido:', data);
    fetchUnreadCount();
});

adminSocket.on('message:read', (data) => {
    console.log('[AdminSocket] message:read recibido:', data);
    fetchUnreadCount();
    triggerReloadMensajes();
});

adminSocket.on('message:deleted', (data) => {
    console.log('[AdminSocket] message:deleted recibido:', data);
    fetchUnreadCount();
    triggerReloadMensajes();
});

adminSocket.on('notification', (data) => {
    if (!data || !data.type) return;
    if (data.type === 'new_message') {
        const msg = data.data || {};
        Swal.fire({
            icon: 'info',
            title: 'Nuevo mensaje',
            html: `<strong>${escHtml(msg.nombre || 'Usuario')}</strong><br>${msg.mensaje ? escHtml(msg.mensaje.substring(0, 80)) + '...' : ''}`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', () => Swal.stopTimer());
                toast.addEventListener('mouseleave', () => Swal.resumeTimer());
            },
        });
    }
    if (data.type === 'new_order') {
        const order = data.data || {};
        Swal.fire({
            icon: 'success',
            title: 'Nuevo pedido',
            html: `Pedido #${order.id_pedido}<br>Total: C$${typeof formatPrice === 'function' ? formatPrice(order.total) : order.total}<br>Cliente: ${order.usuario || '—'}`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 6000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', () => Swal.stopTimer());
                toast.addEventListener('mouseleave', () => Swal.resumeTimer());
            },
        });
    }
    if (data.type === 'order_updated') {
        Swal.fire({
            icon: 'info',
            title: 'Pedido actualizado',
            text: `Pedido #${data.data?.id} ahora: ${data.data?.status}`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
        });
    }
});

adminSocket.on('products:changed', () => {
    const page = getCurrentPage();
    if (page === 'productos-buscar.html' || page === 'stock-bajo.html') {
        const appContent = document.getElementById('appContent');
        if (appContent && appContent.querySelector('.productos-buscar-page')) {
            if (typeof cargarProductos === 'function') cargarProductos();
        }
        if (appContent && appContent.querySelector('.stock-bajo-page')) {
            if (typeof cargarAlertas === 'function') cargarAlertas();
        }
    }
});

adminSocket.on('order:status_updated', () => {
    const page = getCurrentPage();
    if (page === 'ordenes.html' && typeof cargarOrdenes === 'function') {
        const appContent = document.getElementById('appContent');
        if (appContent && appContent.querySelector('.ordenes-page')) cargarOrdenes();
    }
});

adminSocket.on('orders:changed', () => {
    const page = getCurrentPage();
    if (page === 'ordenes.html' && typeof cargarOrdenes === 'function') {
        cargarOrdenes();
    }
});

adminSocket.on('categories:changed', () => {
    const page = getCurrentPage();
    if (page === 'categorias.html' && typeof renderCatTable === 'function') {
        renderCatTable();
    }
});

adminSocket.on('coupons:changed', () => {
    const page = getCurrentPage();
    if (page === 'cupones.html' && typeof cargarCupones === 'function') {
        cargarCupones();
    }
});
