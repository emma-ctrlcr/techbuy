/* ══════════════════════════════════════════════════════════════
   TECHBUY — shared.js
   Lógica centralizada del header para TODAS las páginas.
   Carga DESPUÉS de datos.js.

   Sistema de 3 barras:
   - Barra 1 (header): se oculta con transform al hacer scroll down
   - Barras 2 (nav) y 3 (breadcrumb): siempre visibles, suben junto con barra 1

   Uso en cada página:
   document.addEventListener('DOMContentLoaded', () => {
     TB_loadCart();
     TB_updateCartUI();
     TB_setupSharedHeader();
     // resto de inicialización...
   });
══════════════════════════════════════════════════════════════ */

/* ─── NAVEGACIÓN ────────────────────────────────────────── */
function TB_navigate(url) { window.location.href = url; }
window.TB_navigate = TB_navigate;

/* ─── UNIFIED HEADER SCROLL ────────────────────────────────
   Barra 1 (header) se oculta con translateY(-86px).
   Todo el grupo (barras 2 y 3) también se traduce.
   Cuando scroll up: translateY(0).
   El body padding-top se ajusta dinámicamente para evitar saltos.
══════════════════════════════════════════════════════════════ */
function TB_setupSharedHeader() {
  const scrollEl = document.getElementById("tb-header-scroll");
  if (!scrollEl) return;

  // Actualizar badge desde cualquier pagina al cargar
  TB_updateCartUI();

  // Validar token silenciosamente al cargar — si expiró o es inválido, limpiar sesión
  if (TB_api && TB_api.isLoggedIn()) {
    TB_api.get("/auth/me").then(data => {
      // Token válido: actualizar datos frescos del usuario
      const user = data.user || data;
      localStorage.setItem("techbuy_user", JSON.stringify(user));
      TB_currentUser = user;
      TB_updateAccountBtn();
    }).catch(() => {
      // Token inválido o expirado: limpiar todo
      TB_api.clearSession();
      TB_currentUser = null;
      TB_updateAccountBtn();
    });
  }

  // Sincronizar badge cuando cambia el carrito en otra pestana
  window.addEventListener("storage", (e) => {
    if (e.key === "techbuy_cart") {
      try { TB_cart = JSON.parse(e.newValue || "[]"); } catch(err) { TB_cart = []; }
      TB_updateCartUI();
    }
  });

  const H = 86; // altura de la barra 1 (header)
  let lastY = window.scrollY;
  let ticking = false;
  let headerHidden = false;

  // Padding dinámico: mide la altura real del header (se adapta en mobile)
  const headerEl = document.getElementById("tb-header");
  function TB_updateBodyPadding() {
    if (headerEl) document.body.style.paddingTop = headerEl.offsetHeight + "px";
  }
  TB_updateBodyPadding();
  if (window.ResizeObserver) {
    new ResizeObserver(TB_updateBodyPadding).observe(headerEl);
  }
  window.addEventListener("resize", TB_updateBodyPadding, { passive: true });

  function update() {
    const curY = window.scrollY;
    const delta = curY - lastY;

    // Umbral mínimo de scroll
    if (Math.abs(delta) < 5) { ticking = false; return; }

    if (delta > 0 && curY > H && !headerHidden) {
      // Scroll down: ocultar barra 1 — solo transform, sin tocar padding
      scrollEl.style.transform = "translateY(-" + H + "px)";
      headerHidden = true;
    } else if (delta < 0 && headerHidden) {
      // Scroll up: mostrar barra 1 — solo transform, sin tocar padding
      scrollEl.style.transform = "translateY(0)";
      headerHidden = false;
    }

    lastY = curY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

/* ─── SEARCH AUTOCOMPLETE ────────────────────────────────── */
let acActiveIdx   = -1;
let acSuggestions = [];
let acDebounceTimer = null;
const MAX_SUGGESTIONS = 5;
const DEBOUNCE_MS     = 300;

function TB_highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp("(" + escaped + ")", "gi"), "<mark>$1</mark>");
}

function TB_getSuggestions(query) {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return TB_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.cat.toLowerCase().includes(q)
  ).slice(0, MAX_SUGGESTIONS);
}

function TB_renderSuggestions(items, query) {
  const container = document.getElementById("tb-search-sug");
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="tb-sug-empty">Sin resultados</div>';
    container.classList.add("open");
    return;
  }
  container.innerHTML = items.map((p, i) => `
    <div class="tb-sug-item" data-idx="${i}" role="option">
      ${(p.imagenes && p.imagenes.length > 0)
        ? `<img class="tb-sug-img" src="${p.imagenes[0]}" alt="" onerror="this.style.display='none'">`
        : `<div class="tb-sug-icon"><i class="fa-solid ${TB_iconForCat(p.cat)}"></i></div>`}
      <div class="tb-sug-info">
        <div class="tb-sug-name">${TB_highlightMatch(p.name, query)}</div>
        <div class="tb-sug-brand">${p.brand}</div>
      </div>
      <div class="tb-sug-arrow">›</div>
    </div>`).join("");

  container.querySelectorAll(".tb-sug-item").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      const p = items[Number(el.dataset.idx)];
      if (p) {
        const inp = document.getElementById("tb-search-input");
        if (inp) inp.value = p.name;
        TB_closeSuggestions();
        TB_navigate("producto.html?id=" + p.id);
      }
    });
  });
  container.classList.add("open");
}

function TB_closeSuggestions() {
  const container = document.getElementById("tb-search-sug");
  if (container) container.classList.remove("open");
  acActiveIdx = -1;
  acSuggestions = [];
}

function TB_updateActiveSuggestion() {
  const container = document.getElementById("tb-search-sug");
  if (!container) return;
  const items = container.querySelectorAll(".tb-sug-item");
  items.forEach((el, i) => el.classList.toggle("active", i === acActiveIdx));
  if (acActiveIdx >= 0 && items[acActiveIdx]) {
    items[acActiveIdx].scrollIntoView({ block: "nearest" });
  }
}

function TB_handleSearchKeydown(e) {
  const container = document.getElementById("tb-search-sug");
  if (!container || !container.classList.contains("open") || !acSuggestions.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    acActiveIdx = Math.min(acActiveIdx + 1, acSuggestions.length - 1);
    TB_updateActiveSuggestion();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acActiveIdx = Math.max(acActiveIdx - 1, 0);
    TB_updateActiveSuggestion();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (acActiveIdx >= 0 && acSuggestions[acActiveIdx]) {
      TB_navigate("producto.html?id=" + acSuggestions[acActiveIdx].id);
    } else {
      const q = document.getElementById("tb-search-input")?.value.trim();
      if (q) TB_navigate("categorias.html?q=" + encodeURIComponent(q));
    }
    TB_closeSuggestions();
  } else if (e.key === "Escape") {
    TB_closeSuggestions();
  }
}

function TB_handleSearchInput(e) {
  const query = e.target.value.trim();
  clearTimeout(acDebounceTimer);
  if (!query) { TB_closeSuggestions(); return; }
  acDebounceTimer = setTimeout(() => {
    acSuggestions = TB_getSuggestions(query);
    acActiveIdx = -1;
    TB_renderSuggestions(acSuggestions, query);
  }, DEBOUNCE_MS);
}

function TB_setupSearchAutocomplete() {
  const input = document.getElementById("tb-search-input");
  const btn   = document.getElementById("tb-search-btn");
  if (!input || !btn) return;

  input.addEventListener("input",   TB_handleSearchInput);
  input.addEventListener("keydown", TB_handleSearchKeydown);
  input.addEventListener("search", TB_closeSuggestions);

  btn.addEventListener("click", () => {
    const q = input.value.trim();
    TB_closeSuggestions();
    if (q) TB_navigate("categorias.html?q=" + encodeURIComponent(q));
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".tb-search")) TB_closeSuggestions();
  });
}

/* ─── NAV LINKS (páginas secundarias) ─────────────────────── */
function TB_setupNavLinks() {
  document.querySelectorAll(".tb-nav-link").forEach(link => {
    link.addEventListener("click", () => {
      const page = link.dataset.page;
      if (page === "inicio") TB_navigate("1.html");
      else TB_navigate((page === "catalogo" ? "categorias" : page) + ".html");
    });
  });
  // Logo sin acción — se quitó la navegación
}

/* ─── AUTH MODAL — inyectado dinámicamente en TODAS las páginas ── */
function TB_injectAuthModal() {
  if (document.getElementById("authOverlay")) return; // ya existe (ej: 1.html)
  const div = document.createElement("div");
  div.innerHTML = `
<div class="acct-overlay" id="authOverlay">
  <div class="acct-modal" id="authModal">
    <button class="auth-close-x" id="authClose"><i class="fa-solid fa-xmark"></i></button>

    <!-- LOGIN -->
    <div id="formLogin" class="auth-panel">
      <div class="auth-brand">
        <img src="../img/Gemini_Generated_Image_gp2dx5gp2dx5gp2d.png" alt="TechBuy" class="auth-logo-img" onerror="this.style.display='none'">
        <span class="auth-brand-name">TechBuy</span>
      </div>
      <h2 class="auth-title">Iniciar sesión</h2>
      <p class="auth-subtitle">Accede a tu cuenta para gestionar tus pedidos y perfil.</p>

      <div class="auth-field">
        <label class="auth-label">CORREO ELECTRÓNICO</label>
        <input type="email" id="loginEmail" class="auth-input" placeholder="tu@correo.com" autocomplete="email" />
      </div>
      <div class="auth-field">
        <label class="auth-label">CONTRASEÑA</label>
        <div class="auth-input-eye">
          <input type="password" id="loginPassword" class="auth-input" placeholder="••••••••" autocomplete="current-password" />
          <button type="button" class="auth-eye-btn" id="toggleLoginPwd" tabindex="-1">
            <i class="fa-regular fa-eye" id="loginEyeIcon"></i>
          </button>
        </div>
      </div>

      <div class="auth-row-extras">
        <label class="auth-remember">
          <input type="checkbox" id="loginRemember" />
          <span>Recuérdame</span>
        </label>
        <button type="button" class="auth-forgot">¿Olvidaste tu contraseña?</button>
      </div>

      <div class="auth-msg" id="loginMsg"></div>

      <button class="auth-btn-main" id="btnDoLogin" onclick="handleLogin()">Iniciar sesión</button>

      <p class="auth-switch">¿No tienes cuenta? <button type="button" class="auth-switch-link" onclick="switchAuthTab('register')">Regístrate ahora</button></p>
    </div>

    <!-- REGISTRO -->
    <div id="formRegister" class="auth-panel" style="display:none">
      <div class="auth-brand">
        <img src="../img/Gemini_Generated_Image_gp2dx5gp2dx5gp2d.png" alt="TechBuy" class="auth-logo-img" onerror="this.style.display='none'">
        <span class="auth-brand-name">TechBuy</span>
      </div>
      <h2 class="auth-title">Crear cuenta</h2>
      <p class="auth-subtitle">Únete y empieza a comprar los mejores productos tech.</p>

      <div class="acct-row">
        <div class="auth-field">
          <label class="auth-label">NOMBRE</label>
          <input type="text" id="regNombre" class="auth-input" placeholder="Juan" autocomplete="given-name" />
        </div>
        <div class="auth-field">
          <label class="auth-label">APELLIDO</label>
          <input type="text" id="regApellido" class="auth-input" placeholder="Pérez" autocomplete="family-name" />
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label">CORREO ELECTRÓNICO</label>
        <input type="email" id="regEmail" class="auth-input" placeholder="tu@correo.com" autocomplete="email" />
      </div>
      <div class="auth-field">
        <label class="auth-label">CONTRASEÑA</label>
        <div class="auth-input-eye">
          <input type="password" id="regPassword" class="auth-input" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
          <button type="button" class="auth-eye-btn" id="toggleRegPwd" tabindex="-1">
            <i class="fa-regular fa-eye" id="regEyeIcon"></i>
          </button>
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label">TELÉFONO <span style="font-weight:400;text-transform:none;letter-spacing:0">(opcional)</span></label>
        <input type="text" id="regTel" class="auth-input" placeholder="88001234" maxlength="8" inputmode="numeric" />
      </div>

      <div class="auth-msg" id="registerMsg"></div>

      <button class="auth-btn-main" id="btnDoRegister" onclick="handleRegister()">
        <i class="fa-solid fa-user-plus"></i> Crear cuenta
      </button>

      <p class="auth-switch">¿Ya tienes cuenta? <button type="button" class="auth-switch-link" onclick="switchAuthTab('login')">Inicia sesión</button></p>
    </div>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);

  // Eventos del modal
  document.getElementById("authClose")?.addEventListener("click", TB_closeAuthModal);
  document.getElementById("authOverlay")?.addEventListener("click", e => {
    if (e.target === document.getElementById("authOverlay")) TB_closeAuthModal();
  });
  ["loginEmail","loginPassword"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
  });
  ["regNombre","regApellido","regEmail","regPassword","regTel"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => { if (e.key === "Enter") handleRegister(); });
  });
  document.getElementById("regTel")?.addEventListener("input", function(){ this.value = this.value.replace(/\D/g,"").slice(0,8); });

  // Toggle mostrar/ocultar contraseña
  document.getElementById("toggleLoginPwd")?.addEventListener("click", () => {
    const inp = document.getElementById("loginPassword");
    const icon = document.getElementById("loginEyeIcon");
    if (inp.type === "password") { inp.type = "text"; icon.className = "fa-regular fa-eye-slash"; }
    else { inp.type = "password"; icon.className = "fa-regular fa-eye"; }
  });
  document.getElementById("toggleRegPwd")?.addEventListener("click", () => {
    const inp = document.getElementById("regPassword");
    const icon = document.getElementById("regEyeIcon");
    if (inp.type === "password") { inp.type = "text"; icon.className = "fa-regular fa-eye-slash"; }
    else { inp.type = "password"; icon.className = "fa-regular fa-eye"; }
  });
}

function TB_openAuthModal(tab) {
  TB_injectAuthModal(); // asegura que el modal exista
  const overlay = document.getElementById("authOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  switchAuthTab(tab || "login");
  ["loginEmail","loginPassword","loginMsg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value !== undefined ? (el.value = "") : (el.textContent = "");
  });
  ["regNombre","regApellido","regEmail","regPassword","regTel","registerMsg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value !== undefined ? (el.value = "") : (el.textContent = "");
  });
}

function TB_closeAuthModal() {
  const overlay = document.getElementById("authOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("formLogin").style.display    = isLogin ? "flex" : "none";
  document.getElementById("formRegister").style.display = isLogin ? "none"  : "flex";
}

async function handleLogin() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgEl    = document.getElementById("loginMsg");
  msgEl.textContent = ""; msgEl.className = "auth-msg";

  if (!email || !password) { msgEl.textContent = "Completa todos los campos"; msgEl.className = "auth-msg error"; return; }
  if (!email.endsWith("@gmail.com")) { msgEl.textContent = "Solo se aceptan correos @gmail.com"; msgEl.className = "auth-msg error"; return; }

  const btn = document.getElementById("btnDoLogin");
  btn.disabled = true; btn.textContent = "Entrando…";

  try {
    const data = await TB_api.post("/auth/login", { email, password });
    TB_api.saveSession(data.token, data.user);
    TB_updateAccountBtn();
    msgEl.textContent = "¡Bienvenido!"; msgEl.className = "auth-msg success";
    setTimeout(() => {
      TB_closeAuthModal();
      TB_navigate("perfil.html");
    }, 700);
  } catch(err) {
    msgEl.textContent = err.message || "Credenciales incorrectas"; msgEl.className = "auth-msg error";
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
  }
}

async function handleRegister() {
  const nombre   = document.getElementById("regNombre").value.trim();
  const apellido = document.getElementById("regApellido").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const tel      = document.getElementById("regTel").value.trim();
  const msgEl    = document.getElementById("registerMsg");
  msgEl.textContent = ""; msgEl.className = "auth-msg";

  if (!nombre||!apellido||!email||!password) { msgEl.textContent = "Completa todos los campos requeridos"; msgEl.className = "auth-msg error"; return; }
  if (!email.endsWith("@gmail.com")) { msgEl.textContent = "Solo se aceptan correos @gmail.com"; msgEl.className = "auth-msg error"; return; }
  if (password.length < 6) { msgEl.textContent = "La contraseña debe tener al menos 6 caracteres"; msgEl.className = "auth-msg error"; return; }
  if (tel && !/^\d{8}$/.test(tel)) { msgEl.textContent = "Teléfono: 8 dígitos numéricos"; msgEl.className = "auth-msg error"; return; }

  const btn = document.getElementById("btnDoRegister");
  btn.disabled = true; btn.textContent = "Creando cuenta…";

  try {
    const data = await TB_api.post("/auth/register", { nombre, apellido, email, password, tel });
    TB_api.saveSession(data.token, data.user);
    TB_updateAccountBtn();
    msgEl.textContent = "¡Cuenta creada!"; msgEl.className = "auth-msg success";
    setTimeout(() => {
      TB_closeAuthModal();
      TB_navigate("perfil.html");
    }, 700);
  } catch(err) {
    msgEl.textContent = err.message || "Error al registrar"; msgEl.className = "auth-msg error";
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear cuenta';
  }
}

// Exponer globalmente para que funcionen los onclick inline del HTML de 1.html
window.TB_openAuthModal  = TB_openAuthModal;
window.TB_closeAuthModal = TB_closeAuthModal;
window.switchAuthTab     = switchAuthTab;
window.handleLogin       = handleLogin;
window.handleRegister    = handleRegister;

/* ─── ACCOUNT BUTTON ──────────────────────────────────────── */
function TB_setupAccountBtn() {
  const btn = document.getElementById("tb-account-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (TB_api && TB_api.isLoggedIn()) {
      TB_navigate("perfil.html");
    } else {
      // Guardar página actual para regresar tras el login
      sessionStorage.setItem("tb_login_return", window.location.href);
      TB_navigate("login.html");
    }
  });
  TB_updateAccountBtn(btn);
}

function TB_updateAccountBtn(btn) {
  if (!btn) btn = document.getElementById("tb-account-btn");
  if (!btn) return;
  if (TB_api && TB_api.isLoggedIn()) {
    const user = (() => { try { return JSON.parse(localStorage.getItem("techbuy_user")||"null"); } catch(e){return null;} })();
    const nombre = user?.nombre || "Mi cuenta";
    btn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${nombre}`;
  } else {
    btn.innerHTML = `<i class="fa-regular fa-user"></i> Mi cuenta`;
  }
}

/* ─── CART SETUP ────────────────────────────────────────────── */
function TB_setupCartSidebar() {
  // Cart button: new tb- prefix or legacy id
  const cartBtn = document.getElementById("tb-cart-btn") || document.getElementById("btnCart");
  if (cartBtn) cartBtn.addEventListener("click", () => TB_navigate("carrito.html"));

  // Close buttons: tb- prefix or legacy id
  const cartClose = document.getElementById("tb-cart-close") || document.getElementById("cartClose");
  if (cartClose) cartClose.addEventListener("click", () => window.history.back());
}
