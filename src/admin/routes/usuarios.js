const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const columnsCheck = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'`
        );
        const columnNames = columnsCheck.rows.map(c => c.column_name);

        let query = 'SELECT id_usuario, username, email';
        if (columnNames.includes('nombre')) query += ', nombre';
        if (columnNames.includes('apellido')) query += ', apellido';
        if (columnNames.includes('tel')) query += ', tel';
        if (columnNames.includes('address')) query += ', address';
        if (columnNames.includes('city')) query += ', city';
        if (columnNames.includes('activo')) query += ', activo';
        if (columnNames.includes('fecha_registro')) query += ', fecha_registro as created_at';
        else if (columnNames.includes('created_at')) query += ', created_at';
        query += ' FROM public.usuarios ORDER BY id_usuario DESC';

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET /api/usuarios:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?:\s[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/;

function validateNameField(value, label) {
    if (!value || value.trim() === '') return null;
    if (!NAME_REGEX.test(value.trim())) {
        return `${label} solo puede contener letras y espacios, sin números ni símbolos.`;
    }
    return null;
}

router.post('/', verificarAdmin, async (req, res) => {
    const { username, email, password, nombre, apellido, tel, address, city } = req.body;
    const nameErr = validateNameField(nombre, 'Nombre') || validateNameField(apellido, 'Apellido');
    if (nameErr) return res.status(400).json({ error: nameErr });

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO public.usuarios (username, email, password, nombre, apellido, tel, address, city)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_usuario`,
            [username, email, hashedPassword, nombre || '', apellido || '', tel || '', address || '', city || '']
        );
        res.status(201).json({ success: true, id: result.rows[0].id_usuario });
    } catch (error) {
        console.error('Error POST /api/usuarios:', error.message);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El username o email ya existe' });
        }
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, email, password, nombre, apellido, tel, address, city, activo } = req.body;
    const nameErr = validateNameField(nombre, 'Nombre') || validateNameField(apellido, 'Apellido');
    if (nameErr) return res.status(400).json({ error: nameErr });

    try {
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 12);
            await pool.query(
                `UPDATE public.usuarios
                 SET username=$1, email=$2, password=$3, nombre=$4, apellido=$5, tel=$6, address=$7, city=$8, activo=$9, updated_at=NOW()
                 WHERE id_usuario=$10`,
                [username, email, hashedPassword, nombre, apellido, tel, address, city, activo, id]
            );
        } else {
            await pool.query(
                `UPDATE public.usuarios
                 SET username=$1, email=$2, nombre=$3, apellido=$4, tel=$5, address=$6, city=$7, activo=$8, updated_at=NOW()
                 WHERE id_usuario=$9`,
                [username, email, nombre, apellido, tel, address, city, activo, id]
            );
        }
        res.json({ success: true, message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error('Error PUT /api/usuarios:', error.message);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('BEGIN');
        await pool.query('DELETE FROM public.pedido_detalle WHERE id_pedido IN (SELECT id_pedido FROM public.pedidos WHERE id_usuario = $1)', [id]);
        await pool.query('DELETE FROM public.pedidos WHERE id_usuario = $1', [id]);
        await pool.query('DELETE FROM public.favoritos WHERE id_usuario = $1', [id]);
        await pool.query('DELETE FROM public.refresh_tokens WHERE id_usuario = $1', [id]);
        await pool.query('DELETE FROM public.metodos_pago_usuario WHERE id_usuario = $1', [id]);
        const result = await pool.query('DELETE FROM public.usuarios WHERE id_usuario = $1 RETURNING id_usuario', [id]);
        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        await pool.query('COMMIT');
        res.json({ success: true, message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error DELETE /api/usuarios:', error.message);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;
