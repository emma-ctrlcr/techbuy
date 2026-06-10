const express = require('express');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id_categoria, c.key, c.nombre, c.icon, c.activo, c.orden,
                    COUNT(p.id_producto) AS total_productos
             FROM public.categorias c
             LEFT JOIN public.productos p ON p.id_categoria = c.id_categoria
             GROUP BY c.id_categoria
             ORDER BY c.orden ASC, c.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET /categorias:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    const { key, nombre, icon, orden } = req.body;
    if (!key || !nombre) {
        return res.status(400).json({ error: 'key y nombre son requeridos' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO public.categorias (key, nombre, icon, orden) VALUES ($1, $2, $3, $4) RETURNING *',
            [key, nombre, icon || 'fa-box', orden ?? 0]
        );
        emitAdminEvent('categories:changed', { action: 'created', id: result.rows[0].id_categoria });
        res.json({ success: true, categoria: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'La categoría ya existe (mismo nombre o slug)' });
        } else {
            console.error('Error POST /categorias:', error.message);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { key, nombre, icon, activo, orden } = req.body;
    try {
        await pool.query(
            'UPDATE public.categorias SET key=$1, nombre=$2, icon=$3, activo=$4, orden=$5 WHERE id_categoria=$6',
            [key, nombre, icon, activo, orden ?? 0, id]
        );
        emitAdminEvent('categories:changed', { action: 'updated', id: parseInt(id) });
        res.json({ success: true, message: 'Categoría actualizada' });
    } catch (error) {
        console.error('Error PUT /categorias:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const check = await pool.query(
            'SELECT COUNT(*) AS cnt FROM public.productos WHERE id_categoria = $1', [id]
        );
        const count = parseInt(check.rows[0].cnt);
        if (count > 0) {
            return res.status(400).json({
                error: `No se puede eliminar: ${count} producto(s) usan esta categoría. Reasígnelos primero.`
            });
        }
        await pool.query('DELETE FROM public.categorias WHERE id_categoria = $1', [id]);
        emitAdminEvent('categories:changed', { action: 'deleted', id: parseInt(id) });
        res.json({ success: true, message: 'Categoría eliminada' });
    } catch (error) {
        console.error('Error DELETE /categorias:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
