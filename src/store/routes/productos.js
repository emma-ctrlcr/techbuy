const router = require('express').Router();
const pool   = require('../db/pool');

const MAX_PER_PAGE = 100;

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
  p.created_at,
  p.updated_at
`;

const SAFE_SORTS = {
  precio_asc:  'p.precio ASC',
  precio_desc: 'p.precio DESC',
  nombre:      'p.nombre ASC',
  default:     'p.created_at DESC',
  created_at:  'p.created_at DESC',
};

function parsePagination(query) {
  const pageNum  = Math.max(1, parseInt(query.page) || 1);
  const perPage  = Math.max(1, Math.min(MAX_PER_PAGE, parseInt(query.limit) || 12));
  const offset   = (pageNum - 1) * perPage;
  return { pageNum, perPage, offset };
}

function buildWhereClause(filters) {
  const conditions = [];
  const params     = [];
  let idx = 1;

  if (filters.cat && filters.cat !== 'all') {
    conditions.push(`c.key = $${idx++}`);
    params.push(filters.cat);
  }
  if (filters.badge) {
    conditions.push(`p.badge = $${idx++}`);
    params.push(filters.badge);
  }
  if (filters.maxPrice != null && !isNaN(parseFloat(filters.maxPrice))) {
    conditions.push(`p.precio <= $${idx++}`);
    params.push(parseFloat(filters.maxPrice));
  }
  if (filters.q) {
    conditions.push(`(p.nombre ILIKE $${idx} OR p.brand ILIKE $${idx} OR c.key ILIKE $${idx})`);
    params.push(`%${filters.q}%`);
    idx++;
  }
  if (filters.extra) {
    conditions.push(filters.extra);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params, idx };
}

async function attachImages(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(p => p.id);
  const { rows: imgRows } = await pool.query(
    `SELECT id_producto, url FROM public.imagenes_producto
     WHERE id_producto = ANY($1) ORDER BY id_imagen`,
    [ids]
  );
  const imgMap = {};
  imgRows.forEach(r => {
    if (!imgMap[r.id_producto]) imgMap[r.id_producto] = [];
    imgMap[r.id_producto].push(r.url);
  });
  return rows.map(p => ({ ...p, imagenes: imgMap[p.id] || [] }));
}

// GET /productos — paginado con filtros
router.get('/', async (req, res) => {
  const { cat, q, badge, sort, maxPrice } = req.query;
  const { pageNum, perPage, offset } = parsePagination(req.query);
  const orderClause = SAFE_SORTS[sort] || SAFE_SORTS.default;

  const { where, params, idx } = buildWhereClause({ cat, q, badge, maxPrice });

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         ${where}
         ORDER BY ${orderClause}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, perPage, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         ${where}`,
        params
      ),
    ]);

    const products = await attachImages(dataResult.rows);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / perPage);

    return res.json({ total, totalPages, page: pageNum, limit: perPage, products });
  } catch (err) {
    console.error('Error en GET /productos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/destacados — top 10 con mejor descuento para carrusel
router.get('/destacados', async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit) || 10);
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
       ORDER BY (p.precio_anterior - p.precio) DESC
       LIMIT $1`,
      [limit]
    );
    const products = await attachImages(rows);
    return res.json(products);
  } catch (err) {
    console.error('Error en GET /productos/destacados:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/ofertas — paginado con descuento
router.get('/ofertas', async (req, res) => {
  const { cat } = req.query;
  const { pageNum, perPage, offset } = parsePagination(req.query);

  const extra = 'p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio';
  const { where, params, idx } = buildWhereClause({ cat, extra });

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS},
                ROUND(((p.precio_anterior - p.precio) / p.precio_anterior * 100)) AS descuento_pct
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         ${where}
         ORDER BY p.precio_anterior - p.precio DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, perPage, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         ${where}`,
        params
      ),
    ]);

    const products = await attachImages(dataResult.rows);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / perPage);

    return res.json({ total, totalPages, page: pageNum, limit: perPage, products });
  } catch (err) {
    console.error('Error en GET /productos/ofertas:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/nuevos — últimos productos agregados
router.get('/nuevos', async (req, res) => {
  const { pageNum, perPage, offset } = parsePagination(req.query);

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
        [perPage, offset]
      ),
      pool.query('SELECT COUNT(*) AS total FROM public.productos'),
    ]);

    const products = await attachImages(dataResult.rows);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / perPage);

    return res.json({ total, totalPages, page: pageNum, limit: perPage, products });
  } catch (err) {
    console.error('Error en GET /productos/nuevos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /productos/carrito — validar stock/precio de productos específicos
router.post('/carrito', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Se requiere un array de IDs' });
  }

  const sanitized = ids.map(Number).filter(n => !isNaN(n));
  if (!sanitized.length) {
    return res.status(400).json({ error: 'IDs inválidos' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE p.id_producto = ANY($1)`,
      [sanitized]
    );
    const products = await attachImages(rows);
    return res.json(products);
  } catch (err) {
    console.error('Error en POST /productos/carrito:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/conteo-categorias — conteo por categoría
router.get('/conteo-categorias', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.key, c.nombre, COUNT(p.id_producto)::int AS count
       FROM public.categorias c
       LEFT JOIN public.productos p ON p.id_categoria = c.id_categoria
       GROUP BY c.id_categoria, c.key, c.nombre
       ORDER BY c.orden ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /productos/conteo-categorias:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/:id/relacionados — relacionados por categoría y marca
router.get('/:id/relacionados', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const product = await pool.query(
      'SELECT id_categoria, brand FROM public.productos WHERE id_producto = $1',
      [id]
    );
    if (!product.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const { id_categoria, brand } = product.rows[0];

    const [related, sameBrand, crossSell] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE p.id_categoria = $1 AND p.id_producto != $2
         ORDER BY p.created_at DESC LIMIT 8`,
        [id_categoria, id]
      ),
      brand ? pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE p.brand = $1 AND p.id_producto != $2 AND p.id_categoria != $3
         ORDER BY p.created_at DESC LIMIT 8`,
        [brand, id, id_categoria]
      ) : { rows: [] },
      pool.query(
        `SELECT ${SELECT_COLS}
         FROM public.productos p
         LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
         WHERE p.id_categoria != $1 AND p.id_producto != $2
         ORDER BY RANDOM() LIMIT 8`,
        [id_categoria, id]
      ),
    ]);

    const [relatedWithImg, brandWithImg, crossWithImg] = await Promise.all([
      attachImages(related.rows),
      attachImages(sameBrand.rows),
      attachImages(crossSell.rows),
    ]);

    return res.json({
      related: relatedWithImg,
      sameBrand: brandWithImg,
      crossSell: crossWithImg,
    });
  } catch (err) {
    console.error('Error en GET /productos/:id/relacionados:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /productos/:id — detalle completo (debe ir último)
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
       FROM public.productos p
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE p.id_producto = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const imgResult = await pool.query(
      'SELECT url FROM public.imagenes_producto WHERE id_producto = $1',
      [id]
    );
    const product = { ...rows[0], imagenes: imgResult.rows.map(r => r.url) };

    return res.json(product);
  } catch (err) {
    console.error('Error en GET /productos/:id:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
