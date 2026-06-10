(function () {
  function initSocket() {
    if (typeof io === 'undefined') {
      console.warn('[Socket] io no disponible, reintentando...');
      setTimeout(initSocket, 500);
      return;
    }
    const socket = io(window.location.origin + '/store', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    window.storeSocket = socket;

    socket.on('connect', () => {
      console.log('[Socket /store] Conectado');
    });

    socket.on('disconnect', () => {
      console.log('[Socket /store] Desconectado');
    });

    socket.on('products:changed', () => {
      TB_cacheClear();
      const grid = document.getElementById('inicio-grid');
      const catGrid = document.getElementById('catsGrid');
      const ofertaGrid = document.getElementById('oferta-grid');
      if (grid && typeof renderInicioGrid === 'function') renderInicioGrid();
      if (grid && typeof TB_renderCarousel === 'function') TB_renderCarousel();
      if (catGrid && typeof applyCatFilters === 'function') applyCatFilters();
      if (ofertaGrid && typeof TB_renderOfertas === 'function') TB_renderOfertas();
      window.dispatchEvent(new CustomEvent('store:products:changed'));
    });

    socket.on('carousel:changed', () => {
      if (typeof TB_renderHeroAds === 'function') TB_renderHeroAds();
    });

    socket.on('categories:changed', () => {
      if (typeof TB_loadCats === 'function') {
        TB_loadCats().then(() => {
          window.dispatchEvent(new CustomEvent('store:categories:changed'));
          TB_setupSharedHeader();
        });
      }
    });

    socket.on('order:created', () => {
      window.dispatchEvent(new CustomEvent('store:order:created'));
    });

    socket.on('order:status_updated', (data) => {
      window.dispatchEvent(new CustomEvent('store:order:status_updated', { detail: data }));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocket);
  } else {
    initSocket();
  }
})();
