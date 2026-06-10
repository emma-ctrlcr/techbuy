const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { emitStoreEvent, emitAdminEvent } = require('../../socket');
const { sanitizeBody } = require('../middleware/sanitize');

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
    console.error('Error en GET /pedidos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
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
    console.error('Error en GET /pedidos/:id:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const createPedidoValidation = [
  body('address').trim().notEmpty().withMessage('La dirección es requerida'),
  body('city').trim().notEmpty().withMessage('La ciudad es requerida'),
  body('dept').trim().notEmpty().withMessage('El departamento es requerido'),
  body('tel').optional({ values: 'falsy' }).matches(/^\d{8}$/).withMessage('El teléfono debe tener 8 dígitos numéricos'),
  sanitizeBody,
];

router.post('/', requireAuth, createPedidoValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { tel, address, city, dept, zip, cupon, id_metodo_usuario } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cartRows } = await client.query(
      'SELECT id_carrito FROM public.carritos WHERE id_usuario = $1',
      [req.user.id_usuario]
    );
    if (!cartRows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El carrito está vacío' });
    }
    const cartId = cartRows[0].id_carrito;

    const { rows: cartItems } = await client.query(
      `SELECT ci.id_producto, ci.cantidad, p.nombre, p.precio, p.stock, p.brand
       FROM public.carrito_items ci
       JOIN public.productos p ON p.id_producto = ci.id_producto
       WHERE ci.id_carrito = $1`,
      [cartId]
    );
    if (!cartItems.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    let subtotal = 0;
    const lineItems = [];

    for (const item of cartItems) {
      if (item.stock < item.cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Stock insuficiente para "${item.nombre}" (disponible: ${item.stock})`
        });
      }
      subtotal += parseFloat(item.precio) * item.cantidad;
      lineItems.push({ id_producto: item.id_producto, cantidad: item.cantidad, prod: item });
    }

    const iva      = subtotal * 0.15;
    const conIva   = subtotal + iva;

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

    let discountFrac = 0;
    let discountAmt  = 0;

    if (cupon) {
      const { rows: cupRows } = await client.query(
        `SELECT id_cupon, descuento, usos_max, usos_actual, activo,
                fecha_inicio, fecha_fin
         FROM public.cupones
         WHERE UPPER(codigo) = UPPER($1)
           AND activo = TRUE
           AND (fecha_inicio IS NULL OR fecha_inicio <= NOW())
           AND (fecha_fin IS NULL OR fecha_fin >= NOW())`,
        [cupon]
      );
      if (!cupRows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cupón inválido, inactivo o expirado' });
      }
      const c = cupRows[0];
      if (c.usos_max !== null && c.usos_actual >= c.usos_max) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El cupón ha alcanzado su límite de usos' });
      }
      discountFrac = parseFloat(c.descuento);
      discountAmt  = conIva * discountFrac;

      await client.query(
        'UPDATE public.cupones SET usos_actual = usos_actual + 1 WHERE id_cupon = $1',
        [c.id_cupon]
      );
    }

    const total = conIva - discountAmt + shipping;

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

    const { rows: pedRows } = await client.query(
      `INSERT INTO public.pedidos
         (id_usuario, id_metodo_usuario, total, discount, dept, city, status, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, 'pagado', NOW())
       RETURNING id_pedido, fecha, total, discount, dept, city, status`,
      [req.user.id_usuario, id_metodo_usuario || null, total, discountAmt, dept, city]
    );
    const pedido = pedRows[0];

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

    await pool.query(
      'DELETE FROM public.carrito_items WHERE id_carrito = $1',
      [cartId]
    );

    emitStoreEvent('order:created', { id: pedido.id_pedido, status: 'pagado' });
    emitAdminEvent('order:new', { id: pedido.id_pedido, total, usuario: req.user.username || req.user.email });
    emitAdminEvent('notification', {
      type: 'new_order',
      data: { id_pedido: pedido.id_pedido, total, usuario: req.user.username || req.user.email }
    });

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
    console.error('Error en POST /pedidos:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
