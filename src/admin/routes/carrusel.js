const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { optimizeImage, deleteImageFiles } = require('../utils/image-optimizer');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

const carruselDir = path.join(__dirname, '..', '..', '..', 'uploads', 'carrusel');
if (!fs.existsSync(carruselDir)) {
    fs.mkdirSync(carruselDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes JPG, PNG y WebP.'));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter
});

router.get('/', verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM public.carrusel_imagenes ORDER BY orden ASC, id_imagen DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('GET /api/carrusel:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', verificarAdmin, (req, res, next) => {
    upload.single('imagen')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Debe seleccionar una imagen' });

    const { activo, titulo, subtitulo, btn_texto, btn_url, orden } = req.body;
    const isActive = activo === 'true' || activo === true;
    const ordenNum = parseInt(orden) || 0;

    try {
        const imgResult = await optimizeImage(req.file.buffer, req.file.originalname, carruselDir, 'carousel');
        const url = imgResult.url;

        const result = await pool.query(
            `INSERT INTO public.carrusel_imagenes (url, activo, titulo, subtitulo, btn_texto, btn_url, orden, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
             RETURNING *`,
            [url, isActive, titulo || '', subtitulo || '', btn_texto || 'Ver Ofertas', btn_url || 'ofertas.html', ordenNum]
        );
        emitAdminEvent('carousel:changed', { action: 'created' });
        res.json({ success: true, message: 'Imagen agregada al carrusel', imagen: result.rows[0] });
    } catch (error) {
        console.error('POST /api/carrusel:', error);
        res.status(500).json({ error: error.message || 'Error al agregar imagen' });
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { activo, titulo, subtitulo, btn_texto, btn_url, orden } = req.body;
    try {
        await pool.query(
            `UPDATE public.carrusel_imagenes
             SET activo=$1, titulo=$2, subtitulo=$3, btn_texto=$4, btn_url=$5, orden=$6, updated_at=NOW()
             WHERE id_imagen=$7`,
            [activo, titulo || '', subtitulo || '', btn_texto || 'Ver Ofertas', btn_url || 'ofertas.html', parseInt(orden) || 0, id]
        );
        emitAdminEvent('carousel:changed', { action: 'updated' });
        res.json({ success: true, message: 'Imagen actualizada' });
    } catch (error) {
        console.error('PUT /api/carrusel:', error.message);
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const imagen = await pool.query('SELECT url FROM public.carrusel_imagenes WHERE id_imagen=$1', [id]);
        if (imagen.rows.length > 0) {
            await deleteImageFiles(imagen.rows[0].url);
        }
        await pool.query('DELETE FROM public.carrusel_imagenes WHERE id_imagen=$1', [id]);
        emitAdminEvent('carousel:changed', { action: 'deleted' });
        res.json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
        console.error('DELETE /api/carrusel:', error.message);
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

module.exports = router;
