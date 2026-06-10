const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const SELECT_ITEM_COLS = `
  ci.id_item,
  ci.id_producto,
  ci.cantidad,
  p.nombre        AS name,
  p.precio        AS price,
  p.precio_anterior AS old,
  p.stock,
  p.brand,
  p.badge,
  c.key           AS cat
`;

async function attachImages(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id_producto);
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
  return rows.map(r => ({ ...r, imagenes: imgMap[r.id_producto] || [] }));
}

async function getOrCreateCart(client, userId) {
  let { rows } = await client.query(
    'SELECT id_carrito FROM public.carritos WHERE id_usuario = $1',
    [userId]
  );
  if (!rows.length) {
    const r = await client.query(
      'INSERT INTO public.carritos (id_usuario) VALUES ($1) RETURNING id_carrito',
      [userId]
    );
    rows = r.rows;
  }
  return rows[0].id_carrito;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: cartRows } = await pool.query(
      'SELECT id_carrito FROM public.carritos WHERE id_usuario = $1',
      [req.user.id_usuario]
    );
    if (!cartRows.length) {
      return res.json({ items: [] });
    }
    const cartId = cartRows[0].id_carrito;
    const { rows: items } = await pool.query(
      `SELECT ${SELECT_ITEM_COLS}
       FROM public.carrito_items ci
       JOIN public.productos p ON p.id_producto = ci.id_producto
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE ci.id_carrito = $1
       ORDER BY ci.created_at`,
      [cartId]
    );
    const result = await attachImages(items);
    return res.json({ items: result });
  } catch (err) {
    console.error('Error en GET /carrito:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/items', requireAuth, async (req, res) => {
  const { id_producto, cantidad } = req.body;
  if (!id_producto || !cantidad || cantidad < 1) {
    return res.status(400).json({ error: 'id_producto y cantidad requeridos' });
  }
  const client = await pool.connect();
  try {
    const { rows: prods } = await client.query(
      'SELECT id_producto, stock FROM public.productos WHERE id_producto = $1',
      [id_producto]
    );
    if (!prods.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const prod = prods[0];
    if (prod.stock < 1) {
      return res.status(409).json({ error: 'Producto agotado' });
    }
    const cartId = await getOrCreateCart(client, req.user.id_usuario);
    const finalQty = Math.min(cantidad, prod.stock);
    await client.query(
      `INSERT INTO public.carrito_items (id_carrito, id_producto, cantidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_carrito, id_producto)
       DO UPDATE SET cantidad = $3, created_at = NOW()`,
      [cartId, id_producto, finalQty]
    );
    const { rows: items } = await client.query(
      `SELECT ${SELECT_ITEM_COLS}
       FROM public.carrito_items ci
       JOIN public.productos p ON p.id_producto = ci.id_producto
       LEFT JOIN public.categorias c ON c.id_categoria = p.id_categoria
       WHERE ci.id_carrito = $1
       ORDER BY ci.created_at`,
      [cartId]
    );
    const result = await attachImages(items);
    return res.status(201).json({ items: result });
  } catch (err) {
    console.error('Error en POST /carrito/items:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

router.put('/items/:id_producto', requireAuth, async (req, res) => {
  const idProducto = parseInt(req.params.id_producto);
  const { cantidad } = req.body;
  if (isNaN(idProducto)) return res.status(400).json({ error: 'ID de producto inválido' });
  if (!cantidad || cantidad < 1) return res.status(400).json({ error: 'cantidad debe ser >= 1' });
  try {
    const { rows: prods } = await pool.query(
      'SELECT stock FROM public.productos WHERE id_producto = $1',
      [idProducto]
    );
    if (!prods.length) return res.status(404).json({ error: 'Producto no encontrado' });
    const finalQty = Math.min(cantidad, prods[0].stock);
    const { rowCount } = await pool.query(
      `UPDATE public.carrito_items ci
       SET cantidad = $1
       FROM public.carritos c
       WHERE ci.id_carrito = c.id_carrito
         AND ci.id_producto = $2
         AND c.id_usuario = $3`,
      [finalQty, idProducto, req.user.id_usuario]
    );
    if (!rowCount) return res.status(404).json({ error: 'Producto no encontrado en el carrito' });
    return res.json({ message: 'Cantidad actualizada', cantidad: finalQty });
  } catch (err) {
    console.error('Error en PUT /carrito/items/:id_producto:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/items/:id_producto', requireAuth, async (req, res) => {
  const idProducto = parseInt(req.params.id_producto);
  if (isNaN(idProducto)) return res.status(400).json({ error: 'ID de producto inválido' });
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.carrito_items ci
       USING public.carritos c
       WHERE ci.id_carrito = c.id_carrito
         AND ci.id_producto = $1
         AND c.id_usuario = $2`,
      [idProducto, req.user.id_usuario]
    );
    if (!rowCount) return res.status(404).json({ error: 'Producto no encontrado en el carrito' });
    return res.json({ message: 'Producto eliminado del carrito' });
  } catch (err) {
    console.error('Error en DELETE /carrito/items/:id_producto:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM public.carrito_items ci
       USING public.carritos c
       WHERE ci.id_carrito = c.id_carrito
         AND c.id_usuario = $1`,
      [req.user.id_usuario]
    );
    return res.json({ message: 'Carrito vaciado' });
  } catch (err) {
    console.error('Error en DELETE /carrito:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
