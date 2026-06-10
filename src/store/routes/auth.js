const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth, ACCESS_SECRET, REFRESH_SECRET, csrfProtection } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const SALT_ROUNDS = 12;

function signAccessToken(user) {
  return jwt.sign(
    { id_usuario: user.id_usuario, email: user.email, rol: user.rol || 'user' },
    ACCESS_SECRET(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id_usuario: user.id_usuario, email: user.email, rol: user.rol || 'user' },
    REFRESH_SECRET(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

function generateTokenFamily() {
  return crypto.randomBytes(16).toString('hex');
}

function userPublic(u) {
  const { password, ...rest } = u;
  return rest;
}

async function storeRefreshToken(client, idUsuario, token, family) {
  await client.query(
    `INSERT INTO public.refresh_tokens (id_usuario, token, family, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [idUsuario, token, family]
  );
}

async function revokeTokenFamily(client, family) {
  await client.query(
    `UPDATE public.refresh_tokens SET revoked = TRUE WHERE family = $1`,
    [family]
  );
}

async function findRefreshToken(token) {
  const { rows } = await pool.query(
    `SELECT * FROM public.refresh_tokens
     WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [token]
  );
  return rows[0];
}

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?:\s[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/;

const registerValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('email').custom(v => {
    if (!v.toLowerCase().endsWith('@gmail.com')) {
      throw new Error('Solo se aceptan correos @gmail.com');
    }
    return true;
  }),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener mínimo 6 caracteres'),
  body('tel').optional({ values: 'falsy' }).matches(/^\d{8}$/).withMessage('El teléfono debe tener 8 dígitos numéricos'),
  body('nombre').optional({ values: 'falsy' }).matches(NAME_REGEX).withMessage('Nombre solo puede contener letras y espacios'),
  body('apellido').optional({ values: 'falsy' }).matches(NAME_REGEX).withMessage('Apellido solo puede contener letras y espacios'),
  sanitizeBody,
];

router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, email, password, nombre, apellido, tel, address, city } = req.body;

  try {
    const exists = await pool.query(
      'SELECT id_usuario FROM public.usuarios WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    let finalUsername = username || email.split('@')[0];
    const userCheck = await pool.query(
      'SELECT id_usuario FROM public.usuarios WHERE username = $1',
      [finalUsername]
    );
    if (userCheck.rows.length > 0) {
      let suffix = 2;
      while (true) {
        const candidate = finalUsername + '_' + suffix;
        const chk = await pool.query(
          'SELECT id_usuario FROM public.usuarios WHERE username = $1',
          [candidate]
        );
        if (chk.rows.length === 0) { finalUsername = candidate; break; }
        suffix++;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await client.query(
        `INSERT INTO public.usuarios
           (username, email, password, nombre, apellido, tel, address, city, rol)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'user')
         RETURNING *`,
        [
          finalUsername,
          email.toLowerCase(),
          hash,
          nombre || '',
          apellido || '',
          tel || '',
          address || '',
          city || '',
        ]
      );

      const user = result.rows[0];
      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      const family = generateTokenFamily();
      await storeRefreshToken(client, user.id_usuario, refreshToken, family);

      await client.query('COMMIT');

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      return res.status(201).json({ token: accessToken, user: userPublic(user) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error en /register:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const result = await pool.query(
      'SELECT * FROM public.usuarios WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const family = generateTokenFamily();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await storeRefreshToken(client, user.id_usuario, refreshToken, family);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return res.json({ token: accessToken, user: userPublic(user) });
  } catch (err) {
    console.error('Error en /login:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/refresh', csrfProtection, async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token requerido' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET());
    const stored = await findRefreshToken(refreshToken);
    if (!stored) {
      return res.status(401).json({ error: 'Refresh token inválido o revocado' });
    }

    const userResult = await pool.query(
      'SELECT * FROM public.usuarios WHERE id_usuario = $1',
      [payload.id_usuario]
    );
    if (!userResult.rows.length) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await revokeTokenFamily(client, stored.family);
      await storeRefreshToken(client, user.id_usuario, newRefreshToken, stored.family);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return res.json({ token: newAccessToken });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expirado', code: 'REFRESH_EXPIRED' });
    }
    console.error('Error en /refresh:', err.message);
    return res.status(401).json({ error: 'Refresh token inválido' });
  }
});

router.post('/logout', csrfProtection, async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (refreshToken) {
    try {
      const stored = await findRefreshToken(refreshToken);
      if (stored) {
        await pool.query(
          `UPDATE public.refresh_tokens SET revoked = TRUE
           WHERE family = $1 OR token = $2`,
          [stored.family, refreshToken]
        );
      }
    } catch (err) {
      console.error('Error en logout:', err.message);
    }
  }

  res.clearCookie('refresh_token', { path: '/api/auth' });
  return res.json({ message: 'Sesión cerrada correctamente' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario, username, email, nombre, apellido,
              tel, address, city, rol, fecha_registro
       FROM public.usuarios
       WHERE id_usuario = $1`,
      [req.user.id_usuario]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en /me:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
