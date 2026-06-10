const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const validarCuponValidation = [
  body('codigo').trim().notEmpty().withMessage('El campo codigo es requerido'),
];

router.post('/validar', requireAuth, validarCuponValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { codigo } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT id_cupon, codigo, descuento, activo,
              usos_max, usos_actual, fecha_inicio, fecha_fin
       FROM public.cupones
       WHERE UPPER(codigo) = UPPER($1)
         AND activo = TRUE
         AND (fecha_inicio IS NULL OR fecha_inicio <= NOW())
         AND (fecha_fin IS NULL OR fecha_fin >= NOW())`,
      [codigo]
    );

    if (!rows.length) {
      return res.status(400).json({ valid: false, error: 'Cupón inválido o inactivo' });
    }

    const c = rows[0];

    if (c.usos_max !== null && c.usos_actual >= c.usos_max) {
      return res.status(400).json({ valid: false, error: 'El cupón ha alcanzado su límite de usos' });
    }

    return res.json({
      valid:     true,
      codigo:    c.codigo,
      descuento: parseFloat(c.descuento),
      porcentaje: Math.round(parseFloat(c.descuento) * 100),
    });
  } catch (err) {
    console.error('Error en POST /cupones/validar:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
