const { generateThumbnailsForExisting } = require('../utils/image-optimizer');
const pool = require('../database/db');

async function generateAllThumbnails() {
    console.log('Generando thumbnails para imágenes de productos...');
    const { rows: productImages } = await pool.query('SELECT id_imagen, url FROM public.imagenes_producto ORDER BY id_imagen');
    let prodOk = 0, prodSkip = 0;
    for (const img of productImages) {
        const sizes = await generateThumbnailsForExisting(img.url);
        if (sizes && Object.keys(sizes).length > 0) {
            console.log(`  [OK] Producto #${img.id_imagen}: ${Object.keys(sizes).length} thumbnails generados`);
            prodOk++;
        } else {
            prodSkip++;
        }
    }
    console.log(`Productos: ${prodOk} procesados, ${prodSkip} saltados (ya existían)`);

    console.log('\nGenerando thumbnails para imágenes del carrusel...');
    const { rows: carruselImages } = await pool.query('SELECT id_imagen, url FROM public.carrusel_imagenes ORDER BY id_imagen');
    let carOk = 0, carSkip = 0;
    for (const img of carruselImages) {
        const sizes = await generateThumbnailsForExisting(img.url);
        if (sizes && Object.keys(sizes).length > 0) {
            console.log(`  [OK] Carrusel #${img.id_imagen}: ${Object.keys(sizes).length} thumbnails generados`);
            carOk++;
        } else {
            carSkip++;
        }
    }
    console.log(`Carrusel: ${carOk} procesados, ${carSkip} saltados`);

    console.log('\n✅ Proceso completado.');
    process.exit(0);
}

generateAllThumbnails().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
