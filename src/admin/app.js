const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { sanitizeInput } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const productoRoutes = require('./routes/productos');
const ordenRoutes = require('./routes/ordenes');
const usuarioRoutes = require('./routes/usuarios');
const adminUserRoutes = require('./routes/adminUsers');
const alertaRoutes = require('./routes/alertas');
const carruselRoutes = require('./routes/carrusel');
const cuponRoutes = require('./routes/cupones');
const mensajeRoutes = require('./routes/mensajes');
const categoriaRoutes = require('./routes/categorias');
const imagenRoutes = require('./routes/imagenes');

function createAdminApp(app, prefix, pool) {
  const isProd = process.env.NODE_ENV === 'production';

  const adminSession = session({
    store: new pgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || (isProd ? (() => { throw new Error('SESSION_SECRET es requerido en producción'); })() : 'dev_secret_change_me'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  });

  app.use(prefix + '/', adminSession);
  app.use(prefix + '/', sanitizeInput);

  app.use(prefix + '/auth', authRoutes);
  app.use(prefix + '/admin', adminRoutes);
  app.use(prefix + '/productos', productoRoutes);
  app.use(prefix + '/ordenes', ordenRoutes);
  app.use(prefix + '/usuarios', usuarioRoutes);
  app.use(prefix + '/admin-users', adminUserRoutes);
  app.use(prefix + '/alertas', alertaRoutes);
  app.use(prefix + '/carrusel', carruselRoutes);
  app.use(prefix + '/cupones', cuponRoutes);
  app.use(prefix + '/mensajes', mensajeRoutes);
  app.use(prefix + '/categorias', categoriaRoutes);
  app.use(prefix + '/imagenes', imagenRoutes);
}

module.exports = { createAdminApp };
