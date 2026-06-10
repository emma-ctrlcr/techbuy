const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         f.id_favorito,
         p.id_producto AS id,
         p.nombre AS name,
         p.precio AS price,
         p.precio_anterior AS old,
         p.brand,
         p.badge,
         p.stock,
         c.key  AS cat,
         c.icon AS cat_icon,
         f.created_at,
         COALESCE(
           (SELECT json_agg(url) FROM public.imagenes_producto WHERE id_producto = p.id_producto),
           '[]'::json
         ) AS imagenes
       FROM public.favoritos f
       JOIN public.productos  p ON p.id_producto = f.id_producto
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE f.id_usuario = $1
       ORDER BY f.created_at DESC`,
      [req.user.id_usuario]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /favoritos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const createFavoritoValidation = [
  body('id_producto').isInt({ min: 1 }).withMessage('id_producto es requerido y debe ser un número válido'),
];

router.post('/', requireAuth, createFavoritoValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { id_producto } = req.body;

  try {
    const { rows: prodRows } = await pool.query(
      'SELECT id_producto FROM public.productos WHERE id_producto = $1',
      [id_producto]
    );
    if (!prodRows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.favoritos (id_usuario, id_producto)
       VALUES ($1, $2)
       ON CONFLICT (id_usuario, id_producto) DO NOTHING
       RETURNING id_favorito`,
      [req.user.id_usuario, id_producto]
    );

    if (!rows.length) {
      return res.status(200).json({ message: 'Ya estaba en favoritos' });
    }
    return res.status(201).json({ message: 'Agregado a favoritos', id_favorito: rows[0].id_favorito });
  } catch (err) {
    console.error('Error en POST /favoritos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id_producto', requireAuth, async (req, res) => {
  const id_producto = parseInt(req.params.id_producto);
  if (isNaN(id_producto)) {
    return res.status(400).json({ error: 'ID de producto inválido' });
  }

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM public.favoritos WHERE id_usuario = $1 AND id_producto = $2',
      [req.user.id_usuario, id_producto]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'El producto no está en favoritos' });
    }
    return res.json({ message: 'Eliminado de favoritos' });
  } catch (err) {
    console.error('Error en DELETE /favoritos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
