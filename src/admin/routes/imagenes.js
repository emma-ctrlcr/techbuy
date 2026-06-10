const express = require('express');
const path = require('path');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { generateThumbnailsForExisting } = require('../utils/image-optimizer');
const router = express.Router();

router.post('/reoptimize', verificarAdmin, async (req, res) => {
    try {
        const { rows: productImages } = await pool.query('SELECT id_imagen, url, id_producto FROM public.imagenes_producto ORDER BY id_imagen');
        const { rows: carruselImages } = await pool.query('SELECT id_imagen, url FROM public.carrusel_imagenes ORDER BY id_imagen');

        let productOk = 0, carruselOk = 0;
        const errors = [];

        for (const img of productImages) {
            try {
                const sizes = await generateThumbnailsForExisting(img.url);
                if (sizes && Object.keys(sizes).length > 0) productOk++;
            } catch (e) {
                errors.push(`Producto imagen #${img.id_imagen}: ${e.message}`);
            }
        }

        for (const img of carruselImages) {
            try {
                const sizes = await generateThumbnailsForExisting(img.url);
                if (sizes && Object.keys(sizes).length > 0) carruselOk++;
            } catch (e) {
                errors.push(`Carrusel imagen #${img.id_imagen}: ${e.message}`);
            }
        }

        res.json({
            success: true,
            message: `Thumbnails generados: ${productOk} productos, ${carruselOk} carrusel`,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Error reoptimizando imágenes:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
