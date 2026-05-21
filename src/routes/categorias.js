// src/routes/categorias.js
// GET /api/categorias — Listar todas las categorías

const router = require('express').Router();
const pool   = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_categoria, nombre, key, icon
       FROM public.categorias
       ORDER BY nombre ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /categorias:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
