const express = require('express');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const maxStock = parseInt(req.query.max_stock) || 3;
        const result = await pool.query(`
            SELECT p.*, c.nombre as categoria_nombre,
                   (SELECT url FROM public.imagenes_producto WHERE id_producto = p.id_producto LIMIT 1) as imagen
            FROM public.productos p
            LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
            WHERE p.stock <= $1
            ORDER BY p.stock ASC
        `, [maxStock]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo alertas:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.get('/check', verificarAdmin, async (req, res) => {
    try {
        const maxStock = parseInt(req.query.max_stock) || 3;
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM public.productos WHERE stock <= $1 AND activo = true',
            [maxStock]
        );
        res.json({ cantidad: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error verificando alertas:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;