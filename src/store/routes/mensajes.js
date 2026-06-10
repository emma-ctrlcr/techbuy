const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool   = require('../db/pool');
const { emitStoreEvent, emitAdminEvent } = require('../../socket');
const { sanitizeBody } = require('../middleware/sanitize');

const mensajeValidation = [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('asunto').optional({ values: 'falsy' }).trim()
    .isLength({ max: 100 }).withMessage('El asunto no puede exceder 100 caracteres'),
  body('mensaje').trim().notEmpty().withMessage('El mensaje es requerido')
    .isLength({ max: 5000 }).withMessage('El mensaje no puede exceder 5000 caracteres'),
  body('telefono').optional({ values: 'falsy' }).trim(),
  sanitizeBody,
];

router.post('/', mensajeValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { nombre, email, telefono, asunto, mensaje } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.contactos (nombre, email, telefono, asunto, mensaje, leido, respondido, created_at)
       VALUES ($1, $2, $3, $4, $5, false, false, NOW()) RETURNING *`,
      [nombre.trim(), email.trim(), (telefono || '').trim(), (asunto || '').trim(), mensaje.trim()]
    );
    const msg = rows[0];
    console.log('[Socket] Emitiendo nuevoMensaje a /admin:', msg.id_contacto, msg.nombre);
    emitAdminEvent('nuevoMensaje', msg);
    emitAdminEvent('message:new', { id: msg.id_contacto, nombre: msg.nombre });
    emitAdminEvent('notification', { type: 'new_message', data: msg });
    return res.json({ success: true, mensaje: msg });
  } catch (err) {
    console.error('[Mensajes] Error al guardar:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
