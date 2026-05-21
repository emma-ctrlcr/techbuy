// src/routes/envios.js
// GET /api/envios              — Listar costos de envío por departamento
// GET /api/envios/:departamento — Costo de envío de un departamento específico

const router = require('express').Router();
const pool   = require('../db/pool');

/* ── GET /api/envios ──────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT departamento, costo
       FROM public.envios_departamento
       WHERE activo = true
       ORDER BY departamento ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /envios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/envios/:departamento ───────────────────────── */
router.get('/:departamento', async (req, res) => {
  const { departamento } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT departamento, costo
       FROM public.envios_departamento
       WHERE activo = true
         AND LOWER(departamento) = LOWER($1)`,
      [departamento]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Departamento no encontrado o sin cobertura' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error en GET /envios/:departamento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
