const router = require('express').Router();
const pool   = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_imagen, url, activo, titulo, subtitulo, btn_texto, btn_url, orden
       FROM public.carrusel_imagenes
       WHERE activo = true
       ORDER BY orden ASC, id_imagen ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /carrusel:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
