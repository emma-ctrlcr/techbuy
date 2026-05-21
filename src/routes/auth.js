// src/routes/auth.js
// POST /api/auth/register  — Registrar usuario
// POST /api/auth/login     — Iniciar sesión
// GET  /api/auth/me        — Datos del usuario autenticado

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* ── Helpers ──────────────────────────────────────────────── */
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado en .env');
  return jwt.sign(
    { id_usuario: user.id_usuario, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function userPublic(u) {
  // Nunca devolver el hash de password al cliente
  return {
    id_usuario: u.id_usuario,
    username:   u.username,
    email:      u.email,
    nombre:     u.nombre,
    apellido:   u.apellido,
    tel:        u.tel,
    address:    u.address,
    city:       u.city,
    fecha_registro: u.fecha_registro,
  };
}

/* ── POST /api/auth/register ──────────────────────────────── */
router.post('/register', async (req, res) => {
  const { username, email, password, nombre, apellido, tel, address, city } = req.body;

  // Validaciones básicas
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Solo se aceptan correos @gmail.com' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  }
  if (tel && !/^\d{8}$/.test(tel)) {
    return res.status(400).json({ error: 'El teléfono debe tener 8 dígitos numéricos' });
  }

  try {
    // Verificar si ya existe
    const exists = await pool.query(
      'SELECT id_usuario FROM public.usuarios WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    // Usar transacción para que un fallo en signToken no deje usuario sin token
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hash = await bcrypt.hash(password, 10);
      let finalUsername = username || email.split('@')[0];
      // Asegurar que el username sea único (puede quedar ocupado si otro usuario
      // cambió su email pero mantiene el username original)
      const userCheck = await client.query(
        'SELECT id_usuario FROM public.usuarios WHERE username = $1',
        [finalUsername]
      );
      if (userCheck.rows.length > 0) {
        let suffix = 2;
        while (true) {
          const candidate = finalUsername + '_' + suffix;
          const chk = await client.query(
            'SELECT id_usuario FROM public.usuarios WHERE username = $1',
            [candidate]
          );
          if (chk.rows.length === 0) { finalUsername = candidate; break; }
          suffix++;
        }
      }
      const result = await client.query(
        `INSERT INTO public.usuarios
           (username, email, password, nombre, apellido, tel, address, city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          finalUsername,
          email.toLowerCase(),
          hash,
          nombre   || '',
          apellido || '',
          tel      || '',
          address  || '',
          city     || '',
        ]
      );

      const user  = result.rows[0];
      const token = signToken(user);   // si falla aquí, hace ROLLBACK

      await client.query('COMMIT');
      return res.status(201).json({ token, user: userPublic(user) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;  // re-lanza al catch externo
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error en /register:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── POST /api/auth/login ─────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Solo se aceptan correos @gmail.com' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM public.usuarios WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];
    const ok   = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = signToken(user);
    return res.json({ token, user: userPublic(user) });
  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/auth/me ─────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario, username, email, nombre, apellido,
              tel, address, city, fecha_registro
       FROM public.usuarios
       WHERE id_usuario = $1`,
      [req.user.id_usuario]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Devolver plano igual que register/login para consistencia con el frontend
    return res.json(userPublic(result.rows[0]));
  } catch (err) {
    console.error('Error en /me:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
