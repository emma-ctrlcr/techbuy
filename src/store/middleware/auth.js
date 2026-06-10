const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET());
    req.user = {
      id_usuario: payload.id_usuario,
      email: payload.email,
      rol: payload.rol || 'user',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' });
    }
    next();
  });
}

function optionalAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, ACCESS_SECRET());
      req.user = {
        id_usuario: payload.id_usuario,
        email: payload.email,
        rol: payload.rol || 'user',
      };
    } catch (_) {}
  }
  next();
}

function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const csrfCookie = req.cookies && req.cookies['_csrf'];
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF token inválido o ausente' });
  }

  next();
}

function setCsrfCookie(req, res, next) {
  const secret = process.env.CSRF_SECRET || 'techbuy-csrf-dev';
  const csrfToken = crypto
    .createHmac('sha256', secret)
    .update(req.sessionID || req.ip || 'default')
    .digest('hex');

  if (!req.cookies || req.cookies['_csrf'] !== csrfToken) {
    res.cookie('_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth, csrfProtection, setCsrfCookie, ACCESS_SECRET, REFRESH_SECRET };
