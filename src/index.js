// src/index.js — TechBuy API
require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');

// Rutas
const authRouter       = require('./routes/auth');
const usuariosRouter   = require('./routes/usuarios');
const productosRouter  = require('./routes/productos');
const categoriasRouter = require('./routes/categorias');
const pedidosRouter    = require('./routes/pedidos');
const favoritosRouter  = require('./routes/favoritos');
const cuponesRouter    = require('./routes/cupones');
const enviosRouter     = require('./routes/envios');
const metodosPagoRouter= require('./routes/metodosPago');
const carruselRouter   = require('./routes/carrusel');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Servir frontend estático desde public/ ────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// ── Servir imágenes subidas desde el módulo admin ─────────────
// El admin guarda en: <ruta_admin>/uploads/imagenes/ y uploads/carrusel/
// Configura ADMIN_UPLOADS_DIR en .env apuntando a esa carpeta
const ADMIN_UPLOADS = process.env.ADMIN_UPLOADS_DIR
  ? path.resolve(process.env.ADMIN_UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'modulo admin 5.0', 'uploads');

app.use('/uploads', express.static(ADMIN_UPLOADS));
console.log(`📁 Sirviendo uploads del admin desde: ${ADMIN_UPLOADS}`);

// ── Redirect raíz → página de inicio ─────────────────────────
app.get('/', (req, res) => {
  res.redirect('/pages/1.html');
});

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/usuarios',     usuariosRouter);
app.use('/api/productos',    productosRouter);
app.use('/api/categorias',   categoriasRouter);
app.use('/api/pedidos',      pedidosRouter);
app.use('/api/favoritos',    favoritosRouter);
app.use('/api/cupones',      cuponesRouter);
app.use('/api/envios',       enviosRouter);
app.use('/api/metodos-pago', metodosPagoRouter);
app.use('/api/carrusel',     carruselRouter);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── 404 para rutas /api no encontradas ────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Fallback: cualquier otra ruta → index del frontend ────────
app.use((req, res) => {
  res.redirect('/pages/1.html');
});

// ── Error global ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Arrancar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  TechBuy API corriendo en http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:  ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
});

module.exports = app;
