const jwt = require('../utils/jwt');

async function verificarAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verificarToken(authHeader.split(' ')[1]);
            req.admin = decoded;
            req.session = req.session || {};
            req.session.adminId = decoded.id_admin;
            return next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado' });
            }
            return res.status(401).json({ error: 'Token inválido' });
        }
    }

    if (!req.session.adminId) {
        return res.status(401).json({ error: 'No autorizado. Inicie sesión primero.' });
    }

    req.admin = {
        id_admin: req.session.adminId,
        username: req.session.adminUsername,
        carnet: req.session.adminCarnet,
        rol: req.session.adminRol || 'admin',
    };
    next();
}

function verificarRol(...roles) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ error: 'No autorizado.' });
        }
        const userRole = req.admin.rol || 'admin';
        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
        }
        next();
    };
}

module.exports = { verificarAdmin, verificarRol };
