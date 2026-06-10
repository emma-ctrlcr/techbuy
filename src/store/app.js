const authRouter       = require('./routes/auth');
const usuariosRouter   = require('./routes/usuarios');
const productosRouter  = require('./routes/productos');
const categoriasRouter = require('./routes/categorias');
const searchRouter     = require('./routes/search');
const pedidosRouter    = require('./routes/pedidos');
const favoritosRouter  = require('./routes/favoritos');
const cuponesRouter    = require('./routes/cupones');
const enviosRouter     = require('./routes/envios');
const metodosPagoRouter= require('./routes/metodosPago');
const carruselRouter   = require('./routes/carrusel');
const mensajesRouter   = require('./routes/mensajes');
const carritoRouter    = require('./routes/carrito');

function createStoreApp(app, prefix) {
  app.use(prefix + '/auth',         authRouter);
  app.use(prefix + '/usuarios',     usuariosRouter);
  app.use(prefix + '/productos',    productosRouter);
  app.use(prefix + '/categorias',   categoriasRouter);
  app.use(prefix + '/search',       searchRouter);
  app.use(prefix + '/pedidos',      pedidosRouter);
  app.use(prefix + '/favoritos',    favoritosRouter);
  app.use(prefix + '/cupones',      cuponesRouter);
  app.use(prefix + '/envios',       enviosRouter);
  app.use(prefix + '/metodos-pago', metodosPagoRouter);
  app.use(prefix + '/carrusel',      carruselRouter);
  app.use(prefix + '/mensajes',      mensajesRouter);
  app.use(prefix + '/carrito',       carritoRouter);
}

module.exports = { createStoreApp };
