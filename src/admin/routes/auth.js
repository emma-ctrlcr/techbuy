const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../database/db');
const { loginRules } = require('../middleware/security');
const { generarToken } = require('../utils/jwt');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
});

router.post('/login', loginLimiter, loginRules, async (req, res) => {
    const { username, password, carnet } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM admins WHERE username = $1 AND carnet = $2',
            [username, carnet]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario, contraseña o carnet incorrectos' });
        }

        const admin = result.rows[0];
        const passwordValida = await bcrypt.compare(password, admin.password);

        if (!passwordValida) {
            return res.status(401).json({ error: 'Usuario, contraseña o carnet incorrectos' });
        }

        const token = generarToken({
            id_admin: admin.id_admin,
            username: admin.username,
            carnet: admin.carnet,
            rol: admin.rol || 'admin',
        });

        req.session.adminId = admin.id_admin;
        req.session.adminUsername = admin.username;
        req.session.adminCarnet = admin.carnet;
        req.session.adminRol = admin.rol || 'admin';

        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            admin: {
                id_admin: admin.id_admin,
                username: admin.username,
                carnet: admin.carnet,
                rol: admin.rol || 'admin',
            }
        });
    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error en logout:', err.message);
            return res.status(500).json({ error: 'Error del servidor' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Sesión cerrada' });
    });
});

router.get('/verify', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const { verificarToken } = require('../utils/jwt');
            const decoded = verificarToken(authHeader.split(' ')[1]);
            return res.json({
                loggedIn: true,
                username: decoded.username,
                carnet: decoded.carnet,
                rol: decoded.rol || 'admin',
            });
        } catch {
            return res.json({ loggedIn: false });
        }
    }

    if (req.session.adminId) {
        res.json({
            loggedIn: true,
            username: req.session.adminUsername,
            carnet: req.session.adminCarnet,
            rol: req.session.adminRol || 'admin',
        });
    } else {
        res.json({ loggedIn: false });
    }
});

module.exports = router;