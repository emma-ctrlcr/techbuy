/* ── SPA Router ───────────────────────────────────────────── */
window.showConfirm = window.showConfirm || async function(t,r){return confirm(r||'¿Estás seguro?')};
window.showAlert = window.showAlert || function(m,t){m&&alert(m)};
window.showLoading = window.showLoading || async function(){};
window.closeLoading = window.closeLoading || function(){};

const loadedScripts = new Set();
const SPA_PAGES = new Set([...SIDEBAR_PAGES.map(p => p.file), 'vermensajes.html']);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[SPA] admin DCL start');
    const { page, query } = parseCurrentURL();
    console.log('[SPA] admin DCL page=' + page + ' query=' + query);
    const target = SPA_PAGES.has(page) ? '/admin/' + page : '/admin/' + SIDEBAR_PAGES[0].file;
    console.log('[SPA] admin DCL loadPage target=' + target);
    await loadPage(target, true);
    console.log('[SPA] admin DCL loadPage done, calling setupGlobalNav');
    setupGlobalNav();
});

function parseCurrentURL() {
    const path = window.location.pathname.replace(/^\//, '').replace(/^admin\//, '');
    const q = window.location.search;
    return { page: path, query: q };
}

function setupGlobalNav() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || link.hasAttribute('target')) return;
        if (href.startsWith('/logout') || href.startsWith('/login')) return;

        const pathOnly = href.split('?')[0].replace(/^\//, '').replace(/^admin\//, '');
        console.log('[SPA] nav click href=' + href + ' pathOnly=' + pathOnly + ' spa=' + SPA_PAGES.has(pathOnly));
        if (!SPA_PAGES.has(pathOnly)) return;

        e.preventDefault();
        navigateTo(href);
    });

    window.addEventListener('popstate', () => {
        const { page, query } = parseCurrentURL();
        if (page) loadPage('/admin/' + page + query, true);
    });
}

function navigateTo(path) {
    console.log('[DBG] navigateTo', path);
    if (!path) return;
    history.pushState({ path }, '', path);
    loadPage(path);
}

async function loadPage(path, replace) {
    console.log('[DBG] loadPage ENTER', path);
    const appContent = document.getElementById('appContent');
    if (!appContent) { console.log('[DBG] loadPage BAIL no appContent'); return; }

    const pathOnly = path.split('?')[0];
    const page = pathOnly.replace(/^\//, '').replace(/^admin\//, '');
    console.log('[DBG] loadPage page resolved', page);
    const query = path.includes('?') ? path.split('?')[1] : '';
    const pageConfig = SIDEBAR_PAGES.find(p => p.file === page);
    const icon = pageConfig ? pageConfig.icon : 'fa-file';
    const title = pageConfig ? pageConfig.label : page;

    document.getElementById('topBarTitle').innerHTML = `<i class="fas ${icon}"></i> ${title}`;
    document.title = 'TechBuy Admin - ' + title;

    updateSidebarActive(page);

    appContent.innerHTML = '<div class="empty-state"><div class="icon"><i class="fas fa-spinner fa-spin fa-3x" style="opacity:0.5;"></i></div><p>Cargando...</p></div>';

    try {
        const fetchPath = path.startsWith('/') ? path : '/' + path;
        const resp = await fetch(fetchPath);
        const html = await resp.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const newContent = doc.querySelector('.content');
        appContent.innerHTML = newContent ? newContent.innerHTML : '';
        console.log('[SPA] loadPage newContent found=' + !!newContent);

        if (replace) {
            const url = query ? '/admin/' + page + '?' + query : '/admin/' + page;
            history.replaceState({ path: url }, '', url);
        }

        const pageStyles = doc.querySelectorAll('link[rel="stylesheet"]');
        const loadedHrefs = new Set(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href));
        pageStyles.forEach(link => {
            if (!loadedHrefs.has(link.href)) {
                document.head.appendChild(link.cloneNode());
                loadedHrefs.add(link.href);
            }
        });

        let scriptsToLoad = 0;
        const pageScripts = doc.querySelectorAll('script[src]');
        console.log('[SPA] loadPage scriptsFound=' + pageScripts.length);
        pageScripts.forEach(oldScript => {
            const src = oldScript.getAttribute('src');
            const excluded = src && (src.includes('global.js') || src.includes('admin.js') || src.includes('admin-socket') || src.includes('swal-init') || src.includes('sweetalert2'));
            const alreadyLoaded = src && loadedScripts.has(src);
            console.log('[SPA] loadPage script=' + src + ' excluded=' + excluded + ' cached=' + alreadyLoaded);
            if (!src || excluded || alreadyLoaded) return;
            loadedScripts.add(src);
            scriptsToLoad++;
            console.log('[SPA] loadPage LOADING ' + src + ' pending=' + scriptsToLoad);
            const newScript = document.createElement('script');
            newScript.src = src;
            newScript.onload = () => {
                if (scriptsToLoad > 0) scriptsToLoad--;
                console.log('[SPA] loadPage LOADED ' + src + ' pending=' + scriptsToLoad);
                if (scriptsToLoad === 0) { console.log('[SPA] callPageInit trigger'); callPageInit(page); }
            };
            newScript.onerror = () => {
                console.log('[SPA] loadPage ERROR loading ' + src);
                if (scriptsToLoad > 0) scriptsToLoad--;
                if (scriptsToLoad === 0) { console.log('[SPA] callPageInit trigger (after error)'); callPageInit(page); }
            };
            document.body.appendChild(newScript);
        });
        console.log('[SPA] loadPage scriptsToLoad=' + scriptsToLoad);
        if (scriptsToLoad === 0) { console.log('[SPA] callPageInit trigger (no scripts)'); callPageInit(page); }

        console.log('[SPA] loadPage EXIT OK');
    } catch (e) {
        console.log('[SPA] loadPage EXIT ERROR:', e.message);
        appContent.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-exclamation-triangle fa-3x" style="opacity:0.5;color:var(--danger);"></i></div><p style="color:var(--danger);">Error al cargar: ${e.message}</p></div>`;
    }
}

function tryGetPageInit(page) {
    const map = {
        'productos-buscar.html': 'buscarProductosInit',
        'productos-ingresar.html': 'ingresarProductoInit',
        'stock-bajo.html': 'stockBajoInit',
        'ordenes.html': 'ordenesInit',
        'usuarios-web.html': 'usuariosWebInit',
        'usuarios-admin.html': 'usuariosAdminInit',
        'carrusel.html': 'carruselInit',
        'cupones.html': 'cuponesInit',
        'mensajes.html': 'mensajesInit',
        'vermensajes.html': 'verMensajesInit',
        'categorias.html': 'categoriasInit',
    };
    const fnName = map[page];
    console.log('[DBG] tryGetPageInit page=' + page + ' funcName=' + fnName + ' typeof window[fnName]=' + typeof window[fnName]);
    return (fnName && window[fnName]) ? window[fnName] : null;
}

function callPageInit(page) {
    console.log('[DBG] callPageInit page=' + page);
    const fn = tryGetPageInit(page);
    if (fn) { console.log('[DBG] callPageInit INVOKING'); fn(); }
}

window.adminNavigate = navigateTo;