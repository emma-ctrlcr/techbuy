const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { verificarAdmin, verificarRol } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id_admin, username, carnet, rol, created_at
             FROM public.admins ORDER BY id_admin DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET /api/admin-users:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    const { username, password, carnet, rol } = req.body;
    if (!username || !password || !carnet) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO public.admins (username, password, carnet, rol)
             VALUES ($1, $2, $3, $4) RETURNING id_admin, username, carnet, rol, created_at`,
            [username, hashedPassword, carnet, rol || 'admin']
        );
        res.status(201).json({ success: true, admin: result.rows[0] });
    } catch (error) {
        console.error('Error POST /api/admin-users:', error.message);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El nombre de usuario o carnet ya existe' });
        }
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, password, carnet, rol } = req.body;
    try {
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 12);
            await pool.query(
                `UPDATE public.admins SET username=$1, password=$2, carnet=$3, rol=$4, updated_at=NOW()
                 WHERE id_admin=$5`,
                [username, hashedPassword, carnet, rol || 'admin', id]
            );
        } else {
            await pool.query(
                `UPDATE public.admins SET username=$1, carnet=$2, rol=$3, updated_at=NOW()
                 WHERE id_admin=$4`,
                [username, carnet, rol || 'admin', id]
            );
        }
        res.json({ success: true, message: 'Admin actualizado' });
    } catch (error) {
        console.error('Error PUT /api/admin-users:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        if (parseInt(id) === req.session.adminId) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        }
        const result = await pool.query(
            'DELETE FROM public.admins WHERE id_admin=$1 RETURNING id_admin', [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin no encontrado' });
        }
        res.json({ success: true, message: 'Admin eliminado' });
    } catch (error) {
        console.error('Error DELETE /api/admin-users:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
