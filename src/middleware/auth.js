// src/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware que verifica el token JWT.
 * Si es válido, agrega req.user = { id_usuario, email }.
 * Si no, responde 401.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id_usuario: payload.id_usuario, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { requireAuth };
