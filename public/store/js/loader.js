/* ══════════════════════════════════════════════════════════════
   LOADER — Anti-FOUC, page loader, fade-in
   Cargar al final del <body> (antes de </body>)
   Dependencia: <html class="tb-loading"> + inline CSS
   El loader se superpone al body. En DOMContentLoaded
   se desvanece (opacity 0) y se oculta con display:none.
══════════════════════════════════════════════════════════════ */
(function() {
  function ready() {
    var html = document.documentElement;
    html.classList.remove('tb-loading');
    html.classList.add('tb-ready');
    /* esperar a que termine la transición CSS (opacity) y luego
       ocultar el loader del layout para permitir clics */
    setTimeout(function() {
      var loader = document.getElementById('tbPageLoader');
      if (loader) loader.style.display = 'none';
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  /* Fade-in completo cuando todos los recursos (imágenes, fuentes) carguen */
  window.addEventListener('load', function() {
    document.documentElement.classList.add('tb-loaded');
  });

  /* Timeout de seguridad: si tarda más de 4s, mostrar igual */
  setTimeout(function() {
    var html = document.documentElement;
    if (html.classList.contains('tb-loading')) {
      html.classList.remove('tb-loading');
      html.classList.add('tb-ready');
      html.classList.add('tb-loaded');
      var loader = document.getElementById('tbPageLoader');
      if (loader) loader.style.display = 'none';
    }
  }, 4000);
})();
