const express = require('express');
const { verificarAdmin } = require('../middleware/auth');
const pool = require('../database/db');
const router = express.Router();

router.get('/dashboard', verificarAdmin, async (req, res) => {
    try {
        const prodCount = await pool.query('SELECT COUNT(*) FROM public.productos');
        const orderCount = await pool.query('SELECT COUNT(*) FROM public.pedidos');
        const userCount = await pool.query('SELECT COUNT(*) FROM public.usuarios');
        const lowStock = await pool.query("SELECT COUNT(*) FROM public.productos WHERE stock <= 100");
        const mensajesNoLeidos = await pool.query("SELECT COUNT(*) FROM public.contactos WHERE leido = false");

        res.json({
            admin: {
                username: req.admin.username,
                carnet: req.admin.carnet
            },
            stats: {
                productos: parseInt(prodCount.rows[0].count),
                ordenes: parseInt(orderCount.rows[0].count),
                usuarios: parseInt(userCount.rows[0].count),
                alertasStock: parseInt(lowStock.rows[0].count),
                mensajesNoLeidos: parseInt(mensajesNoLeidos.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
