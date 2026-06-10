const router = require('express').Router();
const pool   = require('../db/pool');

// GET /search — búsqueda completa paginada
router.get('/', async (req, res) => {
  const { q, page = '1', limit = '12' } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Parámetro "q" requerido' });
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = Math.max(1, Math.min(100, parseInt(limit) || 12));
  const offset  = (pageNum - 1) * perPage;
  const term    = `%${q.trim()}%`;

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           p.id_producto   AS id,
           p.nombre        AS name,
           p.descripcion   AS description,
           p.precio        AS price,
           p.precio_anterior AS old,
           p.stock,
           p.brand,
           p.badge,
           c.key           AS cat,
           c.nombre        AS cat_nombre,
           c.icon          AS cat_icon,
           p.created_at
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE p.nombre ILIKE $1 OR p.brand ILIKE $1 OR c.key ILIKE $1 OR c.nombre ILIKE $1
         ORDER BY
           CASE WHEN p.nombre ILIKE $2 THEN 0
                WHEN p.brand ILIKE $2 THEN 1
                ELSE 2 END,
           p.created_at DESC
         LIMIT $3 OFFSET $4`,
        [term, `${q.trim()}%`, perPage, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE p.nombre ILIKE $1 OR p.brand ILIKE $1 OR c.key ILIKE $1 OR c.nombre ILIKE $1`,
        [term]
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

    return res.json({ total, totalPages, page: pageNum, limit: perPage, products });
  } catch (err) {
    console.error('Error en GET /search:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /search/suggest — autocompletado (máximo 10)
router.get('/suggest', async (req, res) => {
  const { q, limit = '10' } = req.query;
  if (!q || !q.trim()) {
    return res.json([]);
  }

  const maxResults = Math.min(20, Math.max(1, parseInt(limit) || 10));
  const term = `${q.trim()}%`;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id_producto AS id,
         p.nombre      AS name,
         p.precio      AS price,
         p.precio_anterior AS old,
         p.stock,
         p.brand,
         p.badge,
         c.key         AS cat,
         c.nombre      AS cat_nombre
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE p.nombre ILIKE $1 OR p.brand ILIKE $1
       ORDER BY
         CASE WHEN p.nombre ILIKE $2 THEN 0
              WHEN p.brand ILIKE $2 THEN 1
              ELSE 2 END,
         p.created_at DESC
       LIMIT $3`,
      [term, q.trim() + '%', maxResults]
    );

    const ids = rows.map(p => p.id);
    let imgMap = {};
    if (ids.length) {
      const { rows: imgRows } = await pool.query(
        'SELECT DISTINCT ON (id_producto) id_producto, url FROM public.imagenes_producto WHERE id_producto = ANY($1)',
        [ids]
      );
      imgRows.forEach(r => {
        if (!imgMap[r.id_producto]) imgMap[r.id_producto] = r.url;
      });
    }

    const suggestions = rows.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: parseFloat(p.price),
      old: parseFloat(p.old) || null,
      stock: p.stock,
      badge: p.badge,
      cat: p.cat,
      cat_nombre: p.cat_nombre,
      imagen: imgMap[p.id] || null,
    }));

    return res.json(suggestions);
  } catch (err) {
    console.error('Error en GET /search/suggest:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
