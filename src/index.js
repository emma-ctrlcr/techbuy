require('dotenv').config();

const path    = require('path');
const fs      = require('fs');
process.env.TZ = 'America/Managua';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const pool    = require('./store/db/pool');
const { setCsrfCookie, csrfProtection } = require('./store/middleware/auth');
const { createStoreApp } = require('./store/app');
const { createAdminApp } = require('./admin/app');

const app  = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://cdn.socket.io'],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'", 'https://cdn.socket.io'],
      frameSrc: ["'self'", "https://www.google.com"],
      objectSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
}));

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000';
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

app.use(setCsrfCookie);

app.use(compression());

/* ── Static files ── */
const CHARSET_UTF8 = 'charset=utf-8';

function setStaticHeaders(res, filePath) {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, no-cache');
    res.setHeader('Content-Type', 'text/html; ' + CHARSET_UTF8);
  } else if (/\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('Content-Type', (filePath.endsWith('.js') ? 'application/javascript' : 'text/css') + '; ' + CHARSET_UTF8);
  } else if (filePath.endsWith('.webmanifest')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('Content-Type', 'application/manifest+json; ' + CHARSET_UTF8);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

/* ── SEO: inject meta tags + canonical into store HTML pages ── */
const SEO_HEAD = `
  <meta name="description" content="Tienda online de computadoras, laptops, monitores, accesorios y tecnolog\u00eda en Costa Rica.">
  <meta name="keywords" content="laptops, computadoras, monitores, tecnolog\u00eda, gaming, Costa Rica">
  <meta property="og:title" content="Tech Buy">
  <meta property="og:description" content="Tecnolog\u00eda y electr\u00f3nica en Costa Rica">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://www.techbuy.store">`;

app.use('/store', (req, res, next) => {
  if (!req.path.endsWith('.html')) return next();
  const filePath = path.join(__dirname, '..', 'public', 'store', req.path);
  if (!fs.existsSync(filePath)) return next();
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace('</head>', SEO_HEAD + '\n</head>');
  res.type('html').send(html);
});

app.use('/store', express.static(path.join(__dirname, '..', 'public', 'store'), {
  etag: true,
  lastModified: true,
  setHeaders: setStaticHeaders,
}));

const adminSetHeaders = (res, filePath) => {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, no-cache');
    res.setHeader('Content-Type', 'text/html; ' + CHARSET_UTF8);
  } else if (/\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('Content-Type', (filePath.endsWith('.js') ? 'application/javascript' : 'text/css') + '; ' + CHARSET_UTF8);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
};

app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin'), {
  etag: true,
  lastModified: true,
  setHeaders: adminSetHeaders,
}));

app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: setStaticHeaders,
}));

/* ── Uploads (keep 1y immutable — these are user-uploaded images) ── */
const UPLOADS_DIR =
  process.env.NODE_ENV === 'production'
    ? '/data/uploads'
    : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1y', immutable: true }));
const ADMIN_UPLOADS_OLD = path.join(__dirname, '..', '..', 'tech', 'modulo admin 5.0 - copia', 'uploads');
app.use('/uploads', express.static(ADMIN_UPLOADS_OLD, { maxAge: '1y', immutable: true }));

/* ── Redirects ── */
app.get('/', (req, res) => {
  res.redirect('/store/pages/1.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

/* ── SEO: robots.txt ── */
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\n\nSitemap: https://www.techbuy.store/sitemap.xml\n');
});

/* ── SEO: sitemap.xml ── */
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id_producto FROM public.productos');
    const urls = rows.map(r =>
      `  <url><loc>https://www.techbuy.store/store/pages/producto.html?id=${r.id_producto}</loc></url>`
    ).join('\n');
    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>https://www.techbuy.store/</loc></url>\n' +
      '  <url><loc>https://www.techbuy.store/store/pages/1.html</loc></url>\n' +
      urls + '\n' +
      '</urlset>'
    );
  } catch (err) {
    console.error('Error generando sitemap:', err.message);
    res.status(500).type('text/plain').send('Error generando sitemap');
  }
});

/* ── Rate limiting ── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/store/auth/login', authLimiter);
app.use('/api/store/auth/register', authLimiter);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

/* ── Mount Store API ── */
createStoreApp(app, '/api/store');

/* ── Mount Admin API ── */
createAdminApp(app, '/api/admin', pool);

/* ── Health check ── */
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() as db_time');
    return res.json({ status: 'ok', db: 'connected', db_time: rows[0].db_time });
  } catch (err) {
    return res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

/* ── Legacy API redirects (compatibilidad) ── */
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} /api${req.path}. Las rutas ahora usan /api/store/ o /api/admin/` });
});

/* ── 404 handler ── */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
  } else {
    res.redirect('/store/pages/1.html');
  }
});

/* ── Global error handler ── */
app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
