// src/routes/cupones.js
// POST /api/cupones/validar   — Validar un código de cupón y devolver % descuento

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* ── POST /api/cupones/validar ────────────────────────────── */
// Body: { codigo: "TECHBUY10" }
router.post('/validar', requireAuth, async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) {
    return res.status(400).json({ error: 'El campo codigo es requerido' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id_cupon, codigo, descuento, activo,
              usos_max, usos_actual, fecha_inicio, fecha_fin
       FROM public.cupones
       WHERE UPPER(codigo) = UPPER($1)`,
      [codigo]
    );

    if (!rows.length || !rows[0].activo) {
      return res.status(400).json({ valid: false, error: 'Cupón inválido o inactivo' });
    }

    const c   = rows[0];
    const now = new Date();

    if (c.fecha_inicio && new Date(c.fecha_inicio) > now) {
      return res.status(400).json({ valid: false, error: 'El cupón aún no está vigente' });
    }
    if (c.fecha_fin && new Date(c.fecha_fin) < now) {
      return res.status(400).json({ valid: false, error: 'El cupón ha expirado' });
    }
    if (c.usos_max !== null && c.usos_actual >= c.usos_max) {
      return res.status(400).json({ valid: false, error: 'El cupón ha alcanzado su límite de usos' });
    }

    // Devolver la fracción de descuento (0.10 = 10%)
    return res.json({
      valid:     true,
      codigo:    c.codigo,
      descuento: parseFloat(c.descuento), // fracción ej: 0.10
      porcentaje: Math.round(parseFloat(c.descuento) * 100), // ej: 10
    });
  } catch (err) {
    console.error('Error en POST /cupones/validar:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
