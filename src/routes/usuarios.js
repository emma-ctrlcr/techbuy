// src/routes/usuarios.js
// GET  /api/usuarios/perfil          — Ver perfil
// PUT  /api/usuarios/perfil          — Editar perfil
// PUT  /api/usuarios/password        — Cambiar contraseña

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* ── GET /api/usuarios/perfil ─────────────────────────────── */
router.get('/perfil', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, username, email, nombre, apellido,
              tel, address, city, fecha_registro, updated_at
       FROM public.usuarios
       WHERE id_usuario = $1`,
      [req.user.id_usuario]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error en GET /perfil:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PUT /api/usuarios/perfil ─────────────────────────────── */
router.put('/perfil', requireAuth, async (req, res) => {
  const { nombre, apellido, tel, email, address, city, username } = req.body;

  try {
    // Validaciones
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }
    if (tel && !/^\d{8}$/.test(tel)) {
      return res.status(400).json({ error: 'El teléfono debe tener 8 dígitos numéricos' });
    }

    // Si cambia el email, verificar que no esté en uso por otro usuario
    if (email) {
      const { rows } = await pool.query(
        `SELECT id_usuario FROM public.usuarios
         WHERE LOWER(email) = LOWER($1) AND id_usuario <> $2`,
        [email, req.user.id_usuario]
      );
      if (rows.length) {
        return res.status(409).json({ error: 'Ese correo ya está en uso por otra cuenta' });
      }
    }
    // Si cambia el username, verificar que no esté en uso
    if (username) {
      const { rows } = await pool.query(
        'SELECT id_usuario FROM public.usuarios WHERE username = $1 AND id_usuario <> $2',
        [username, req.user.id_usuario]
      );
      if (rows.length) {
        return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE public.usuarios
       SET
         nombre    = COALESCE($1, nombre),
         apellido  = COALESCE($2, apellido),
         tel       = COALESCE($3, tel),
         email     = COALESCE(LOWER($4), email),
         address   = COALESCE($5, address),
         city      = COALESCE($6, city),
         username  = COALESCE($7, username),
         updated_at = NOW()
       WHERE id_usuario = $8
       RETURNING id_usuario, username, email, nombre, apellido,
                 tel, address, city, fecha_registro, updated_at`,
      [nombre, apellido, tel, email, address, city, username, req.user.id_usuario]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({ message: 'Perfil actualizado', user: rows[0] });
  } catch (err) {
    console.error('Error en PUT /perfil:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PUT /api/usuarios/password ──────────────────────────── */
router.put('/password', requireAuth, async (req, res) => {
  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) {
    return res.status(400).json({ error: 'Debes enviar password_actual y password_nueva' });
  }
  if (password_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 6 caracteres' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password FROM public.usuarios WHERE id_usuario = $1',
      [req.user.id_usuario]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password_actual, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await bcrypt.hash(password_nueva, 10);
    await pool.query(
      'UPDATE public.usuarios SET password = $1, updated_at = NOW() WHERE id_usuario = $2',
      [hash, req.user.id_usuario]
    );
    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en PUT /password:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
