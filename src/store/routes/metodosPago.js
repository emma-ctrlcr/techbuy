const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, alias, tipo, ultimos4, created_at
       FROM public.metodos_pago_usuario
       WHERE id_usuario = $1
       ORDER BY created_at DESC`,
      [req.user.id_usuario]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /metodos-pago:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const createMetodoValidation = [
  body('ultimos4').matches(/^\d{4}$/).withMessage('ultimos4 debe ser exactamente 4 dígitos numéricos'),
  body('alias').optional().trim(),
  sanitizeBody,
];

router.post('/', requireAuth, createMetodoValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { alias, tipo = 'card', ultimos4 } = req.body;

  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM public.metodos_pago_usuario
       WHERE id_usuario = $1 AND tipo = $2 AND ultimos4 = $3`,
      [req.user.id_usuario, tipo, ultimos4]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Esta tarjeta ya está guardada' });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.metodos_pago_usuario (id_usuario, alias, tipo, ultimos4)
       VALUES ($1, $2, $3, $4)
       RETURNING id, alias, tipo, ultimos4, created_at`,
      [req.user.id_usuario, alias || `${tipo} *${ultimos4}`, tipo, ultimos4]
    );
    return res.status(201).json({ message: 'Tarjeta guardada', metodo: rows[0] });
  } catch (err) {
    console.error('Error en POST /metodos-pago:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM public.metodos_pago_usuario WHERE id = $1 AND id_usuario = $2',
      [id, req.user.id_usuario]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }
    return res.json({ message: 'Tarjeta eliminada correctamente' });
  } catch (err) {
    console.error('Error en DELETE /metodos-pago:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
