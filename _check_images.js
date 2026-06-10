require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD
});

(async () => {
  const p = await pool.query('SELECT id_imagen, url, id_producto FROM public.imagenes_producto ORDER BY id_imagen LIMIT 10');
  console.log('=== imagenes_producto (first 10) ===');
  p.rows.forEach(r => console.log(JSON.stringify(r)));

  const c = await pool.query('SELECT COUNT(*) FROM public.imagenes_producto');
  console.log('Total product images:', c.rows[0].count);

  const cr = await pool.query('SELECT id_imagen, url, titulo FROM public.carrusel_imagenes ORDER BY id_imagen');
  console.log('=== carrusel_imagenes ===');
  cr.rows.forEach(r => console.log(JSON.stringify(r)));

  const abs = await pool.query("SELECT url FROM public.imagenes_producto WHERE url LIKE 'http%'");
  console.log('Absolute URLs in imagenes_producto:', abs.rows.length);
  abs.rows.forEach(r => console.log('  ', r.url));

  const abs2 = await pool.query("SELECT url FROM public.carrusel_imagenes WHERE url LIKE 'http%'");
  console.log('Absolute URLs in carrusel_imagenes:', abs2.rows.length);
  abs2.rows.forEach(r => console.log('  ', r.url));

  if (p.rows.length > 0) {
    const filePath = path.join(__dirname, 'uploads', p.rows[0].url.replace('/uploads/', ''));
    console.log('First image file path:', filePath, '| exists:', fs.existsSync(filePath));
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
