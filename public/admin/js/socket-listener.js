function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const socket = io(window.location.origin + '/admin', {
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
    } catch {
    }
}

function triggerReloadMensajes() {
    if (typeof cargarMensajes === 'function') {
        cargarMensajes();
    }
}

setInterval(() => {
    console.log('[Socket] Polling fallback: refrescando badge...');
    fetchUnreadCount();
    const currentPage = window.location.pathname.split('/').pop() || (window.location.hash && window.location.hash.replace('#',''));
    if (currentPage === 'mensajes.html') {
        console.log('[Socket] Polling fallback: recargando tabla mensajes...');
        triggerReloadMensajes();
    }
}, 15000);

let socketConnected = false;

socket.on('connect', () => {
    socketConnected = true;
    console.log('[Socket] Conectado al panel admin namespace /admin, ID:', socket.id);
    console.log('[Socket] Transporte usado:', socket.io.engine.transport.name);
});

socket.on('connect_error', (err) => {
    socketConnected = false;
    console.error('[Socket] Error de conexión:', err.message, err.description);
});

socket.on('disconnect', (reason) => {
    console.log('[Socket] Desconectado:', reason);
});

socket.on('nuevoMensaje', (msg) => {
    console.log('[Socket] Evento nuevoMensaje RECIBIDO:', msg.id_contacto, msg.nombre, 'leido:', msg.leido);
    unreadCount++;
    updateBadgeUI();
    playNotificationSound();
    if (typeof agregarFilaMensaje === 'function') {
        console.log('[Socket] Llamando agregarFilaMensaje...');
        agregarFilaMensaje(msg);
    } else {
        console.log('[Socket] agregarFilaMensaje no disponible, recargando tabla...');
        triggerReloadMensajes();
    }
    const currentPage = window.location.pathname.split('/').pop() || (window.location.hash && window.location.hash.replace('#',''));
    if (currentPage !== 'mensajes.html') {
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
});

socket.on('message:new', (data) => {
    console.log('[Socket] Evento message:new recibido:', data);
    unreadCount++;
    updateBadgeUI();
    triggerReloadMensajes();
});

socket.on('message:read', (data) => {
    console.log('[Socket] Evento message:read recibido:', data);
    if (unreadCount > 0) unreadCount--;
    updateBadgeUI();
    triggerReloadMensajes();
});

socket.on('message:deleted', (data) => {
    console.log('[Socket] Evento message:deleted recibido:', data);
    fetchUnreadCount();
    triggerReloadMensajes();
});

socket.on('notification', (data) => {
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
            html: `Pedido #${order.id_pedido}<br>Total: C$${formatPrice(order.total)}<br>Cliente: ${order.usuario || '—'}`,
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

socket.on('products:changed', () => {
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'productos-buscar.html' || currentPage === 'stock-bajo.html') {
        const appContent = document.getElementById('appContent');
        if (appContent && appContent.querySelector('.productos-buscar-page')) {
            if (typeof cargarProductos === 'function') cargarProductos();
        }
        if (appContent && appContent.querySelector('.stock-bajo-page')) {
            if (typeof cargarAlertas === 'function') cargarAlertas();
        }
    }
});

socket.on('order:status_updated', (data) => {
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'ordenes.html') {
        const appContent = document.getElementById('appContent');
        if (appContent && appContent.querySelector('.ordenes-page')) {
            if (typeof cargarOrdenes === 'function') cargarOrdenes();
        }
    }
});

socket.on('orders:changed', () => {
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'ordenes.html' && typeof cargarOrdenes === 'function') {
        cargarOrdenes();
    }
});

socket.on('categories:changed', () => {
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'categorias.html' && typeof renderCatTable === 'function') {
        renderCatTable();
    }
});

socket.on('coupons:changed', () => {
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'cupones.html' && typeof cargarCupones === 'function') {
        cargarCupones();
    }
});
