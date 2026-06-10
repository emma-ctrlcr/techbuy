const jwt = require('jsonwebtoken');

const SECRET = () => process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev_jwt_secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function generarToken(payload) {
    return jwt.sign(payload, SECRET(), { expiresIn: EXPIRES_IN });
}

function verificarToken(token) {
    return jwt.verify(token, SECRET());
}

function middleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }
    try {
        const decoded = verificarToken(header.split(' ')[1]);
        req.admin = decoded;
        req.session = req.session || {};
        req.session.adminId = decoded.id_admin;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
}

module.exports = { generarToken, verificarToken, middleware };
