const express = require('express');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *,
                    (descuento * 100)::int AS descuento,
                    CASE
                      WHEN activo = FALSE THEN 'inactivo'
                      WHEN fecha_fin IS NOT NULL AND fecha_fin < NOW() THEN 'expirado'
                      ELSE 'activo'
                    END as status
             FROM public.cupones
             ORDER BY id_cupon DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET /cupones:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    const { codigo, descuento, usos_max, fecha_inicio, fecha_fin, activo } = req.body;
    if (!codigo || descuento === undefined) {
        return res.status(400).json({ error: 'codigo y descuento son requeridos' });
    }
    try {
        const descuentoNum = parseInt(descuento, 10);
        if (isNaN(descuentoNum) || descuentoNum < 1 || descuentoNum > 100) {
            return res.status(400).json({ error: 'El descuento debe ser un número entero entre 1 y 100' });
        }
        const descuentoDecimal = descuentoNum / 100;
        const fi = fecha_inicio ? (fecha_inicio + ':00') : null;
        const ff = fecha_fin ? (fecha_fin + ':00') : null;
        const result = await pool.query(
            `INSERT INTO public.cupones (codigo, descuento, usos_max, fecha_inicio, fecha_fin, activo)
             VALUES ($1, $2, $3, $4::timestamp AT TIME ZONE 'America/Managua', $5::timestamp AT TIME ZONE 'America/Managua', $6) RETURNING *`,
            [codigo.toUpperCase(), descuentoDecimal, usos_max || null, fi, ff, activo !== false]
        );
        emitAdminEvent('coupons:changed', { action: 'created', id: result.rows[0].id_cupon });
        res.json({ success: true, cupon: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'El código de cupón ya existe' });
        } else {
            console.error('Error POST /cupones:', error.message);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { codigo, descuento, usos_max, usos_actual, fecha_inicio, fecha_fin, activo } = req.body;
    try {
        if (activo === true) {
            const { rows: existing } = await pool.query(
                'SELECT fecha_fin FROM public.cupones WHERE id_cupon = $1', [id]
            );
            if (existing.length && existing[0].fecha_fin && new Date(existing[0].fecha_fin) < new Date()) {
                return res.status(400).json({ error: 'No se puede activar un cupón expirado' });
            }
        }
        const descuentoNum = parseInt(descuento, 10);
        const descuentoDecimal = isNaN(descuentoNum) ? 0 : descuentoNum / 100;
        const fi = fecha_inicio ? (fecha_inicio + ':00') : null;
        const ff = fecha_fin ? (fecha_fin + ':00') : null;
        await pool.query(
            `UPDATE public.cupones
             SET codigo=$1, descuento=$2, usos_max=$3, usos_actual=$4, fecha_inicio=$5::timestamp AT TIME ZONE 'America/Managua', fecha_fin=$6::timestamp AT TIME ZONE 'America/Managua', activo=$7
             WHERE id_cupon=$8`,
            [codigo, descuentoDecimal, usos_max, usos_actual || 0, fi, ff, activo, id]
        );
        emitAdminEvent('coupons:changed', { action: 'updated', id: parseInt(id) });
        res.json({ success: true, message: 'Cupón actualizado' });
    } catch (error) {
        console.error('Error PUT /cupones:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM public.cupones WHERE id_cupon = $1', [id]);
        emitAdminEvent('coupons:changed', { action: 'deleted', id: parseInt(id) });
        res.json({ success: true, message: 'Cupón eliminado' });
    } catch (error) {
        console.error('Error DELETE /cupones:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
