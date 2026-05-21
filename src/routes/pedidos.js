// src/routes/pedidos.js
// GET  /api/pedidos            — Historial de pedidos del usuario
// GET  /api/pedidos/:id        — Detalle de un pedido (con items)
// POST /api/pedidos            — Crear un nuevo pedido (checkout)

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* ── GET /api/pedidos ─────────────────────────────────────── */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id_pedido, p.fecha, p.total, p.discount,
         p.dept, p.city, p.status, p.pdf_url,
         mpu.alias AS metodo_pago, mpu.tipo, mpu.ultimos4
       FROM public.pedidos p
       LEFT JOIN public.metodos_pago_usuario mpu ON mpu.id = p.id_metodo_usuario
       WHERE p.id_usuario = $1
       ORDER BY p.fecha DESC`,
      [req.user.id_usuario]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error en GET /pedidos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/pedidos/:id ─────────────────────────────────── */
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    // Pedido
    const { rows: pedRows } = await pool.query(
      `SELECT
         p.id_pedido, p.fecha, p.total, p.discount,
         p.dept, p.city, p.status, p.pdf_url,
         mpu.alias AS metodo_pago, mpu.tipo, mpu.ultimos4
       FROM public.pedidos p
       LEFT JOIN public.metodos_pago_usuario mpu ON mpu.id = p.id_metodo_usuario
       WHERE p.id_pedido = $1 AND p.id_usuario = $2`,
      [id, req.user.id_usuario]
    );
    if (!pedRows.length) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Items del pedido
    const { rows: items } = await pool.query(
      `SELECT
         d.id_detalle, d.cantidad AS qty, d.precio_unitario AS price, d.brand,
         pr.id_producto AS id, pr.nombre AS name, c.key AS cat
       FROM public.pedido_detalle d
       JOIN public.productos  pr ON pr.id_producto = d.id_producto
       LEFT JOIN public.categorias c ON c.id_categoria = pr.id_categoria
       WHERE d.id_pedido = $1`,
      [id]
    );

    return res.json({ ...pedRows[0], items });
  } catch (err) {
    console.error('Error en GET /pedidos/:id:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── POST /api/pedidos ────────────────────────────────────── */
// Body esperado:
// {
//   tel: "12345678",
//   address: "Calle 5, Casa 10",
//   city: "Managua",
//   dept: "Managua",
//   zip: "10000",
//   cupon: "TECHBUY10",          // opcional
//   items: [
//     { id_producto: 1, cantidad: 2 },
//     { id_producto: 5, cantidad: 1 }
//   ]
// }
router.post('/', requireAuth, async (req, res) => {
  const { tel, address, city, dept, zip, cupon, items, id_metodo_usuario } = req.body;

  // Validaciones de entrada
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
  }
  if (!address || !city || !dept) {
    return res.status(400).json({ error: 'Dirección, ciudad y departamento son requeridos' });
  }
  if (tel && !/^\d{8}$/.test(tel)) {
    return res.status(400).json({ error: 'El teléfono debe tener 8 dígitos numéricos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener precios y stock reales desde la BD
    const ids = items.map(i => i.id_producto);
    const { rows: prods } = await client.query(
      `SELECT id_producto, nombre, precio, stock, brand
       FROM public.productos
       WHERE id_producto = ANY($1::int[])`,
      [ids]
    );

    const prodMap = {};
    prods.forEach(p => { prodMap[p.id_producto] = p; });

    // 2. Verificar stock y calcular subtotal
    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const prod = prodMap[item.id_producto];
      if (!prod) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${item.id_producto} no existe` });
      }
      if (prod.stock < item.cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock})`
        });
      }
      subtotal += parseFloat(prod.precio) * item.cantidad;
      lineItems.push({ ...item, prod });
    }

    // 3. IVA (15%)
    const iva      = subtotal * 0.15;
    const conIva   = subtotal + iva;

    // 4. Costo de envío por departamento
    const shippingMap = {
      'Managua': 60, 'Masaya': 80, 'Granada': 90, 'Carazo': 90,
      'León': 120, 'Chinandega': 140, 'Rivas': 130, 'Boaco': 120,
      'Chontales': 150, 'Matagalpa': 140, 'Jinotega': 160,
      'Estelí': 150, 'Madriz': 170, 'Nueva Segovia': 180,
      'Río San Juan': 220,
      'Región Autónoma de la Costa Caribe Norte': 320,
      'Región Autónoma de la Costa Caribe Sur': 350,
    };
    const shipping = shippingMap[dept] || 0;

    // 5. Aplicar cupón si viene
    let discountFrac = 0;
    let discountAmt  = 0;

    if (cupon) {
      const { rows: cupRows } = await client.query(
        `SELECT id_cupon, descuento, usos_max, usos_actual, activo,
                fecha_inicio, fecha_fin
         FROM public.cupones
         WHERE UPPER(codigo) = UPPER($1)`,
        [cupon]
      );
      if (!cupRows.length || !cupRows[0].activo) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cupón inválido o inactivo' });
      }
      const c = cupRows[0];
      const now = new Date();
      if (c.fecha_inicio && new Date(c.fecha_inicio) > now) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El cupón aún no está vigente' });
      }
      if (c.fecha_fin && new Date(c.fecha_fin) < now) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El cupón ha expirado' });
      }
      if (c.usos_max !== null && c.usos_actual >= c.usos_max) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El cupón ha alcanzado su límite de usos' });
      }
      discountFrac = parseFloat(c.descuento);
      discountAmt  = conIva * discountFrac;

      // Incrementar contador de usos
      await client.query(
        'UPDATE public.cupones SET usos_actual = usos_actual + 1 WHERE id_cupon = $1',
        [c.id_cupon]
      );
    }

    const total = conIva - discountAmt + shipping;

    // 6. Validar método de pago del usuario (opcional)
    let metodoUsuario = null;
    if (id_metodo_usuario) {
      const { rows: mpRows } = await client.query(
        `SELECT id, alias, tipo, ultimos4
         FROM public.metodos_pago_usuario
         WHERE id = $1 AND id_usuario = $2`,
        [id_metodo_usuario, req.user.id_usuario]
      );
      if (!mpRows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Método de pago no válido' });
      }
      metodoUsuario = mpRows[0];
    }

    // 7. Insertar pedido
    const { rows: pedRows } = await client.query(
      `INSERT INTO public.pedidos
         (id_usuario, id_metodo_usuario, total, discount, dept, city, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pagado')
       RETURNING id_pedido, fecha, total, discount, dept, city, status`,
      [req.user.id_usuario, id_metodo_usuario || null, total, discountAmt, dept, city]
    );
    const pedido = pedRows[0];

    // 8. Insertar detalle + descontar stock
    for (const item of lineItems) {
      await client.query(
        `INSERT INTO public.pedido_detalle
           (id_pedido, id_producto, cantidad, precio_unitario, brand)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido.id_pedido, item.id_producto, item.cantidad,
         item.prod.precio, item.prod.brand]
      );
      await client.query(
        'UPDATE public.productos SET stock = stock - $1 WHERE id_producto = $2',
        [item.cantidad, item.id_producto]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Pedido creado correctamente',
      pedido: {
        ...pedido,
        shipping,
        iva: iva.toFixed(2),
        discount: discountAmt.toFixed(2),
        metodo_pago: metodoUsuario,
        items: lineItems.map(i => ({
          id_producto:    i.id_producto,
          name:           i.prod.nombre,
          brand:          i.prod.brand,
          qty:            i.cantidad,
          precio_unitario: parseFloat(i.prod.precio),
        })),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en POST /pedidos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
