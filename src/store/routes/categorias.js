const router = require('express').Router();
const pool   = require('../db/pool');

const SELECT_COLS = `
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
  p.created_at
`;

// GET /categorias — listado de categorías
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_categoria, nombre, key, icon, orden
       FROM public.categorias
       ORDER BY orden ASC, nombre ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /categorias:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /categorias/:key/productos — productos paginados por categoría
router.get('/:key/productos', async (req, res) => {
  const { key } = req.params;
  const pageNum  = Math.max(1, parseInt(req.query.page) || 1);
  const perPage  = Math.max(1, Math.min(100, parseInt(req.query.limit) || 12));
  const offset   = (pageNum - 1) * perPage;
  const sort     = req.query.sort === 'precio' ? 'p.precio ASC' :
                   req.query.sort === '-precio' ? 'p.precio DESC' :
                   req.query.sort === 'nombre' ? 'p.nombre ASC' :
                   'p.created_at DESC';

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE c.key = $1
         ORDER BY ${sort}
         LIMIT $2 OFFSET $3`,
        [key, perPage, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM public.productos p
         JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE c.key = $1`,
        [key]
      ),
    ]);

    const ids = dataResult.rows.map(p => p.id);
    let imgMap = {};
    if (ids.length) {
      const { rows: imgRows } = await pool.query(
        `SELECT id_producto, url FROM public.imagenes_producto
         WHERE id_producto = ANY($1) ORDER BY id_imagen`,
        [ids]
      );
      imgRows.forEach(r => {
        if (!imgMap[r.id_producto]) imgMap[r.id_producto] = [];
        imgMap[r.id_producto].push(r.url);
      });
    }

    const products = dataResult.rows.map(p => ({ ...p, imagenes: imgMap[p.id] || [] }));
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / perPage);

    return res.json({ cat: key, total, totalPages, page: pageNum, limit: perPage, products });
  } catch (err) {
    console.error('Error en GET /categorias/:key/productos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
