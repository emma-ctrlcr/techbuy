require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD
});

const OLD_DIR = 'M:\\modulo admin 5.0\\uploads';

(async () => {
  // Get all files from old directory recursively
  const oldFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else oldFiles.push({ name: entry.name, fullPath, dir: path.basename(dir) });
    });
  }
  walk(OLD_DIR);
  console.log('Files in old uploads:', oldFiles.length);

  // Get all image URLs from DB
  const p = await pool.query('SELECT id_imagen, url, id_producto FROM public.imagenes_producto ORDER BY id_imagen');
  console.log('Images in DB:', p.rows.length);

  // For each DB url, check if the file exists in old directory
  let matched = 0;
  let unmatched = [];
  console.log('\n--- Matching files ---');
  p.rows.forEach(r => {
    const urlPath = r.url.replace('/uploads/', ''); // e.g. "imagenes/prod-xxx.webp"
    const urlFilename = path.basename(urlPath);      // e.g. "prod-xxx.webp"
    const urlSubdir = path.dirname(urlPath);          // e.g. "imagenes"
    
    // Check in old dir recursively by filename
    const oldFile = oldFiles.find(f => f.name.toLowerCase() === urlFilename.toLowerCase());
    if (oldFile) {
      matched++;
      console.log(`  ✅ DB#${r.id_imagen} (prod ${r.id_producto}) -> ${urlFilename} FOUND in ${oldFile.dir}`);
    } else {
      unmatched.push(r);
      console.log(`  ❌ DB#${r.id_imagen} (prod ${r.id_producto}) -> ${urlFilename} MISSING`);
    }
  });

  console.log(`\nMatched: ${matched}/${p.rows.length}`);
  console.log(`Missing: ${unmatched.length}`);
  
  // Also check carrusel
  const cr = await pool.query('SELECT id_imagen, url FROM public.carrusel_imagenes ORDER BY id_imagen');
  console.log('\n=== Carrusel images ===');
  cr.rows.forEach(r => {
    const urlFilename = path.basename(r.url);
    const oldFile = oldFiles.find(f => f.name.toLowerCase() === urlFilename.toLowerCase());
    if (oldFile) {
      console.log(`  ✅ ${r.url} -> FOUND`);
    } else {
      console.log(`  ❌ ${r.url} -> MISSING`);
    }
  });

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
