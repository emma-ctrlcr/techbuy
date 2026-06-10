(function() {
var Toast = null;
try {
    if (typeof Swal !== 'undefined') {
        Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', () => Swal.stopTimer());
                toast.addEventListener('mouseleave', () => Swal.resumeTimer());
            },
            customClass: {
                popup: 'swal-toast',
                title: 'swal-toast-title',
                icon: 'swal-toast-icon',
            },
        });
    }
} catch (e) {
    console.warn('SweetAlert2 Toast init failed:', e);
}

var swalTheme = {
    confirmButtonColor: '#3949AB',
    cancelButtonColor: '#EF4444',
    confirmButtonText: 'Sí, confirmar',
    cancelButtonText: 'Cancelar',
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    customClass: {
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-html',
        icon: 'swal-icon',
    },
    background: '#ffffff',
    backdrop: 'rgba(15,23,42,0.3)',
};

function showAlert(msg, type) {
    if (!msg) return;
    if (Toast) {
        var iconMap = { success: 'success', error: 'error', info: 'info', warning: 'warning' };
        Toast.fire({
            icon: iconMap[type] || 'info',
            title: msg,
            timer: type === 'error' ? 5000 : 3000,
        });
    }
}

async function showConfirm(title, text) {
    if (typeof Swal !== 'undefined') {
        try {
            const result = await Swal.fire({
                ...swalTheme,
                title: title || '¿Estás seguro?',
                text: text || 'Esta acción no se puede deshacer.',
                icon: 'warning',
                iconColor: '#F59E0B',
                confirmButtonText: 'Sí, eliminar',
            });
            return result.isConfirmed;
        } catch (e) {
            console.warn('SweetAlert2 error:', e);
            return confirm(text || '¿Estás seguro?');
        }
    }
    return confirm(text || '¿Estás seguro?');
}

async function showLoading(title) {
    if (typeof Swal !== 'undefined') {
        await Swal.fire({
            title: title || 'Procesando...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading(),
            customClass: {
                popup: 'swal-popup',
                title: 'swal-title',
            },
            background: '#ffffff',
            backdrop: 'rgba(15,23,42,0.3)',
        });
    }
}

function closeLoading() {
    if (typeof Swal !== 'undefined') Swal.close();
}

window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showLoading = showLoading;
window.closeLoading = closeLoading;
})();