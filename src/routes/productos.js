// src/routes/productos.js
// GET  /api/productos              — Listar todos (con filtros + imágenes)
// GET  /api/productos/:id          — Detalle de un producto (con imágenes)
// GET  /api/productos/categoria/:key — Por categoría

const router = require('express').Router();
const pool   = require('../db/pool');

/* ── GET /api/productos ───────────────────────────────────── */
router.get('/', async (req, res) => {
  const { cat, q, badge, sort = 'created_at', limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (cat && cat !== 'all') {
    conditions.push(`c.key = $${idx++}`);
    params.push(cat);
  }
  if (badge) {
    conditions.push(`p.badge = $${idx++}`);
    params.push(badge);
  }
  if (q) {
    conditions.push(
      `(p.nombre ILIKE $${idx} OR p.brand ILIKE $${idx} OR c.key ILIKE $${idx})`
    );
    params.push(`%${q}%`);
    idx++;
  }

  const SAFE_SORTS = {
    precio_asc:  'p.precio ASC',
    precio_desc: 'p.precio DESC',
    nombre:      'p.nombre ASC',
    default:     'p.created_at DESC',
    created_at:  'p.created_at DESC',
  };
  const orderClause = SAFE_SORTS[sort] || SAFE_SORTS.default;
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  params.push(parseInt(limit)  || 50);
  params.push(parseInt(offset) || 0);

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id_producto   AS id,
         p.nombre        AS name,
         p.descripcion   AS description,
         p.precio        AS price,
         p.precio_anterior AS old,
         p.descuento,
         p.stock,
         p.brand,
         p.badge,
         c.key           AS cat,
         c.nombre        AS cat_nombre,
         c.icon          AS cat_icon,
         p.created_at,
         p.updated_at
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       ${where}
       ORDER BY ${orderClause}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    // Agregar imágenes a cada producto
    const products = await Promise.all(rows.map(async (p) => {
      const imgResult = await pool.query(
        'SELECT url FROM public.imagenes_producto WHERE id_producto = $1',
        [p.id]
      );
      return { ...p, imagenes: imgResult.rows.map(r => r.url) };
    }));

    const countParams = params.slice(0, -2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       ${where}`,
      countParams
    );

    return res.json({
      total:    parseInt(countRows[0].total),
      limit:    parseInt(limit),
      offset:   parseInt(offset),
      products,
    });
  } catch (err) {
    console.error('Error en GET /productos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/productos/categoria/:key ───────────────────── */
router.get('/categoria/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id_producto AS id, p.nombre AS name, p.descripcion AS description,
         p.precio AS price, p.precio_anterior AS old, p.stock,
         p.brand, p.badge,
         c.key AS cat, c.nombre AS cat_nombre, c.icon AS cat_icon
       FROM public.productos p
       JOIN public.categorias c ON c.id_categoria = p.id_categoria
        WHERE c.key = $1
        ORDER BY p.created_at DESC`,
      [key]
    );

    const products = await Promise.all(rows.map(async (p) => {
      const imgResult = await pool.query(
        'SELECT url FROM public.imagenes_producto WHERE id_producto = $1',
        [p.id]
      );
      return { ...p, imagenes: imgResult.rows.map(r => r.url) };
    }));

    return res.json({ cat: key, total: products.length, products });
  } catch (err) {
    console.error('Error en GET /productos/categoria:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/productos/:id ───────────────────────────────── */
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id_producto AS id, p.nombre AS name, p.descripcion AS description,
         p.precio AS price, p.precio_anterior AS old,
         p.descuento, p.stock, p.brand, p.badge,
         c.key AS cat, c.nombre AS cat_nombre, c.icon AS cat_icon,
         p.created_at, p.updated_at
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
        WHERE p.id_producto = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    // Traer imágenes del producto
    const imgResult = await pool.query(
      'SELECT url FROM public.imagenes_producto WHERE id_producto = $1',
      [id]
    );
    const product = { ...rows[0], imagenes: imgResult.rows.map(r => r.url) };

    return res.json(product);
  } catch (err) {
    console.error('Error en GET /productos/:id:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
