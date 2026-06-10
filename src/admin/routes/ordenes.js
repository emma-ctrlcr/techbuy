const express = require('express');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username as usuario_nombre 
            FROM public.pedidos p
            LEFT JOIN public.usuarios u ON p.id_usuario = u.id_usuario
            ORDER BY p.fecha DESC
        `);

        const ordenes = await Promise.all(result.rows.map(async (orden) => {
            console.log('[ordenes GET] id_pedido:', orden.id_pedido, 'fecha:', orden.fecha, 'type:', typeof orden.fecha);

            const detalles = await pool.query(`
                SELECT pd.*, pr.nombre as producto_nombre 
                FROM public.pedido_detalle pd
                LEFT JOIN public.productos pr ON pd.id_producto = pr.id_producto
                WHERE pd.id_pedido = $1
            `, [orden.id_pedido]);

            return {
                ...orden,
                detalles: detalles.rows
            };
        }));

        res.json(ordenes);
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.put('/:id/status', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }

    try {
        await pool.query(
            'UPDATE public.pedidos SET status = $1 WHERE id_pedido = $2',
            [status, id]
        );

        emitAdminEvent('order:status_updated', { id: parseInt(id), status });
        emitAdminEvent('notification', { type: 'order_updated', data: { id: parseInt(id), status } });

        res.json({ success: true, message: 'Estado actualizado a ' + status });
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM public.pedido_detalle WHERE id_pedido = $1', [id]);
        await pool.query('DELETE FROM public.pedidos WHERE id_pedido = $1', [id]);

        emitAdminEvent('orders:changed', { action: 'deleted', id: parseInt(id) });
        res.json({ success: true, message: 'Orden eliminada exitosamente' });
    } catch (error) {
        console.error('Error eliminando orden:', error);
        res.status(500).json({ error: 'Error al eliminar orden' });
    }
});

router.delete('/', verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM public.pedido_detalle');
        await pool.query('DELETE FROM public.pedidos');

        emitAdminEvent('orders:changed', { action: 'all_deleted' });
        res.json({ success: true, message: 'Todas las órdenes fueron eliminadas' });
    } catch (error) {
        console.error('Error eliminando todas las órdenes:', error);
        res.status(500).json({ error: 'Error al eliminar órdenes' });
    }
});

module.exports = router;
