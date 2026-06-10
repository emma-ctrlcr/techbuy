const express = require('express');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.contactos ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET /mensajes:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.get('/count', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT COUNT(*) AS cantidad FROM public.contactos WHERE leido = false'
        );
        res.json({ cantidad: parseInt(result.rows[0].cantidad, 10) });
    } catch (error) {
        console.error('Error GET /mensajes/count:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.put('/:id/leido', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE public.contactos SET leido = true WHERE id_contacto = $1',
            [id]
        );
        emitAdminEvent('message:read', { id: parseInt(id) });
        res.json({ success: true });
    } catch (error) {
        console.error('Error marcando mensaje como leído:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.put('/:id/respondido', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE public.contactos SET respondido = true, leido = true WHERE id_contacto = $1',
            [id]
        );
        emitAdminEvent('message:read', { id: parseInt(id) });
        res.json({ success: true });
    } catch (error) {
        console.error('Error marcando mensaje como respondido:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', async (req, res) => {
    const { nombre, email, telefono, asunto, mensaje } = req.body;
    if (!nombre || !email || !mensaje) {
        return res.status(400).json({ error: 'nombre, email y mensaje son requeridos' });
    }
    if (nombre.length < 2 || nombre.length > 100) {
        return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres' });
    }
    if (asunto && asunto.length > 100) {
        return res.status(400).json({ error: 'El asunto no puede exceder 100 caracteres' });
    }
    if (mensaje.length > 5000) {
        return res.status(400).json({ error: 'El mensaje no puede exceder 5000 caracteres' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO public.contactos (nombre, email, telefono, asunto, mensaje, leido, respondido, created_at)
             VALUES ($1, $2, $3, $4, $5, false, false, NOW()) RETURNING *`,
            [nombre, email, telefono || '', asunto || '', mensaje]
        );
        const msg = result.rows[0];
        console.log('[Socket] Emitiendo nuevoMensaje a /admin:', msg.id_contacto, msg.nombre);
        emitAdminEvent('nuevoMensaje', msg);
        emitAdminEvent('message:new', { id: msg.id_contacto, nombre: msg.nombre });
        emitAdminEvent('notification', { type: 'new_message', data: msg });
        res.json({ success: true, mensaje: msg });
    } catch (error) {
        console.error('Error POST /mensajes:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM public.contactos WHERE id_contacto = $1', [id]);
        emitAdminEvent('message:deleted', { id: parseInt(id) });
        res.json({ success: true, message: 'Mensaje eliminado' });
    } catch (error) {
        console.error('Error DELETE /mensajes:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
