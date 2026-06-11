const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../database/db');
const { verificarAdmin } = require('../middleware/auth');
const { optimizeImage, deleteImageFiles } = require('../utils/image-optimizer');
const { emitAdminEvent } = require('../../socket');
const router = express.Router();

const uploadDir = process.env.NODE_ENV === 'production'
  ? '/data/uploads/imagenes'
  : path.join(__dirname, '..', '..', '..', 'uploads', 'imagenes');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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
    const { search, categoria, descuento } = req.query;
    let query = `
        SELECT p.*, c.nombre AS categoria_nombre, c.key AS categoria_key, c.icon AS categoria_icon
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search && search !== '') {
        query += ` AND (p.nombre ILIKE $${paramIndex} OR p.id_producto::text ILIKE $${paramIndex} OR p.brand ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }
    if (categoria && categoria !== 'todos' && categoria !== '') {
        query += ` AND (c.key = $${paramIndex} OR c.nombre = $${paramIndex})`;
        params.push(categoria.toLowerCase());
        paramIndex++;
    }
    if (descuento === 'con') {
        query += ` AND (p.descuento IS NOT NULL AND p.descuento > 0)`;
    } else if (descuento === 'sin') {
        query += ` AND (p.descuento IS NULL OR p.descuento = 0)`;
    }
    query += ` ORDER BY p.id_producto DESC`;

    try {
        const result = await pool.query(query, params);
        const productos = await Promise.all(result.rows.map(async (producto) => {
            const imagenes = await pool.query(
                'SELECT id_imagen, url FROM public.imagenes_producto WHERE id_producto = $1 ORDER BY id_imagen',
                [producto.id_producto]
            );
            return { ...producto, imagenes: imagenes.rows };
        }));
        res.json(productos);
    } catch (error) {
        console.error('Error GET /api/productos:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.get('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.*, c.nombre AS categoria_nombre, c.key AS categoria_key
            FROM public.productos p
            LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
            WHERE p.id_producto = $1
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        const producto = result.rows[0];
        console.log('[GET /api/productos/:id] DB row:', { id: producto.id_producto, precio: producto.precio, precio_anterior: producto.precio_anterior, descuento: producto.descuento });
        const imagenes = await pool.query(
            'SELECT id_imagen, url FROM public.imagenes_producto WHERE id_producto = $1 ORDER BY id_imagen',
            [id]
        );
        res.json({ ...producto, imagenes: imagenes.rows });
    } catch (error) {
        console.error('Error GET /api/productos/:id:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/', verificarAdmin, (req, res, next) => {
    upload.array('imagenes', 5)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const { nombre, descripcion, precio_original, descuento, stock, categoria, brand, badge, activo } = req.body;
    const files = req.files || [];

    console.log('[POST /api/productos] body:', { precio_original, descuento, stock, nombre });

    const parsedOriginal = parseFloat(precio_original);
    if (!nombre || isNaN(parsedOriginal) || parsedOriginal <= 0 || stock === undefined || !categoria) {
        console.warn('[POST] Validación falló:', { nombre, parsedOriginal, stock, categoria });
        return res.status(400).json({ error: 'Faltan campos requeridos: nombre, precio_original, stock, categoria' });
    }

    if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({ success: false, message: 'La descripción del producto es requerida' });
    }

    const parsedStock = parseInt(stock);
    if (isNaN(parsedStock) || parsedStock < 1) {
        return res.status(400).json({ success: false, message: 'El stock mínimo permitido es 1' });
    }

    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'El producto debe tener al menos una imagen' });
    }

    try {
        const catResult = await pool.query(
            'SELECT id_categoria FROM public.categorias WHERE key = $1 OR nombre = $1',
            [categoria.toLowerCase()]
        );
        let categoriaId;
        if (catResult.rows.length > 0) {
            categoriaId = catResult.rows[0].id_categoria;
        } else {
            const nuevaCat = await pool.query(
                'INSERT INTO public.categorias (key, nombre) VALUES ($1, $2) RETURNING id_categoria',
                [categoria.toLowerCase().replace(/\s+/g, '_'), categoria]
            );
            categoriaId = nuevaCat.rows[0].id_categoria;
        }

        const descuentoVal = descuento && parseInt(descuento) > 0 ? Math.min(parseInt(descuento), 100) : null;
        const precioFinal = descuentoVal > 0 ? parseFloat((parsedOriginal * (1 - descuentoVal / 100)).toFixed(2)) : parsedOriginal;
        const precioAnt = descuentoVal > 0 ? parsedOriginal : null;
        const safePrecioFinal = isFinite(precioFinal) ? precioFinal : parsedOriginal;
        const safeStock = isFinite(parseInt(stock)) ? parseInt(stock) : 1;

        console.log('[POST] calculado: precioFinal=', safePrecioFinal, '| precioAnt=', precioAnt, '| descuentoVal=', descuentoVal);

        const result = await pool.query(
            `INSERT INTO public.productos
             (nombre, descripcion, precio, precio_anterior, descuento, stock, id_categoria, brand, badge, activo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING id_producto`,
            [nombre, descripcion || '', safePrecioFinal, precioAnt, descuentoVal, safeStock, categoriaId, brand || null, badge || null, activo !== 'false' && activo !== false]
        );

        const productoId = result.rows[0].id_producto;

        if (files.length > 0) {
            for (const file of files) {
                const result = await optimizeImage(file.buffer, file.originalname, uploadDir, 'product');
                await pool.query(
                    'INSERT INTO public.imagenes_producto (url, id_producto) VALUES ($1, $2)',
                    [result.url, productoId]
                );
            }
        }

        emitAdminEvent('products:changed', { action: 'created', productoId });
        res.json({ success: true, message: 'Producto creado exitosamente', productoId });
    } catch (error) {
        console.error('Error POST /api/productos:', error.message);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.post('/:id/imagenes', verificarAdmin, (req, res, next) => {
    upload.array('imagenes', 5)(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const { id } = req.params;
    const files = req.files || [];
    if (files.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos una imagen' });
    }
    try {
        for (const file of files) {
            const result = await optimizeImage(file.buffer, file.originalname, uploadDir, 'product');
            await pool.query(
                'INSERT INTO public.imagenes_producto (url, id_producto) VALUES ($1, $2)',
                [result.url, id]
            );
        }
        emitAdminEvent('products:changed', { action: 'images_added', id: parseInt(id) });
        res.json({ success: true, message: `${files.length} imagen(es) agregada(s)` });
    } catch (error) {
        console.error('Error POST imagenes:', error.message);
        res.status(500).json({ error: 'Error al guardar imágenes' });
    }
});

router.put('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio_original, descuento, stock, categoria, brand, badge, activo } = req.body;

    console.log('[PUT /api/productos/:id] id:', id, '| body:', { precio_original, descuento, stock, nombre });

    const parsedOriginal = parseFloat(precio_original);
    if (!nombre || isNaN(parsedOriginal) || parsedOriginal <= 0 || stock === undefined || !categoria) {
        console.warn('[PUT] Validación falló:', { nombre, parsedOriginal, stock, categoria });
        return res.status(400).json({ error: 'Faltan campos requeridos: nombre, precio_original, stock, categoria' });
    }

    const parsedStock = parseInt(stock);
    if (isNaN(parsedStock) || parsedStock < 1) {
        return res.status(400).json({ success: false, message: 'El stock mínimo permitido es 1' });
    }

    try {
        const catResult = await pool.query(
            'SELECT id_categoria FROM public.categorias WHERE key = $1 OR nombre = $1',
            [categoria.toLowerCase()]
        );
        let categoriaId;
        if (catResult.rows.length > 0) {
            categoriaId = catResult.rows[0].id_categoria;
        } else {
            const nuevaCat = await pool.query(
                'INSERT INTO public.categorias (key, nombre) VALUES ($1, $2) RETURNING id_categoria',
                [categoria.toLowerCase().replace(/\s+/g, '_'), categoria]
            );
            categoriaId = nuevaCat.rows[0].id_categoria;
        }

        const descuentoVal = descuento && parseInt(descuento) > 0 ? Math.min(parseInt(descuento), 100) : null;
        const precioFinal = descuentoVal > 0 ? parseFloat((parsedOriginal * (1 - descuentoVal / 100)).toFixed(2)) : parsedOriginal;
        const precioAnt = descuentoVal > 0 ? parsedOriginal : null;
        const safePrecioFinal = isFinite(precioFinal) ? precioFinal : parsedOriginal;
        const safeStock = isFinite(parseInt(stock)) ? parseInt(stock) : 1;

        console.log('[PUT] calculado: precioFinal=', safePrecioFinal, '| precioAnt=', precioAnt, '| descuentoVal=', descuentoVal);

        await pool.query(
            `UPDATE public.productos
             SET nombre=$1, descripcion=$2, precio=$3, precio_anterior=$4, descuento=$5,
                 stock=$6, id_categoria=$7, brand=$8, badge=$9, activo=$10, updated_at=NOW()
             WHERE id_producto=$11`,
            [nombre, descripcion || '', safePrecioFinal, precioAnt, descuentoVal, safeStock, categoriaId, brand || null, badge || null, activo !== 'false' && activo !== false, id]
        );

        console.log('[PUT] UPDATE ejecutado correctamente para id:', id);

        emitAdminEvent('products:changed', { action: 'updated', id: parseInt(id) });
        res.json({ success: true, message: 'Producto actualizado exitosamente' });
    } catch (error) {
        console.error('[PUT] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

router.delete('/:id/imagenes/:imgId', verificarAdmin, async (req, res) => {
    const { imgId } = req.params;
    try {
        const img = await pool.query('SELECT url FROM public.imagenes_producto WHERE id_imagen = $1', [imgId]);
        if (img.rows.length > 0) {
            await deleteImageFiles(img.rows[0].url);
        }
        await pool.query('DELETE FROM public.imagenes_producto WHERE id_imagen = $1', [imgId]);
        emitAdminEvent('products:changed', { action: 'image_deleted', id: parseInt(req.params.id) });
        res.json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
        console.error('Error DELETE imagen:', error.message);
        res.status(500).json({ error: 'Error al eliminar imagen' });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('BEGIN');

        const imagenes = await pool.query(
            'SELECT url FROM public.imagenes_producto WHERE id_producto = $1', [id]
        );
        for (const img of imagenes.rows) {
            await deleteImageFiles(img.url);
        }

        await pool.query('DELETE FROM public.imagenes_producto WHERE id_producto = $1', [id]);
        await pool.query('DELETE FROM public.favoritos WHERE id_producto = $1', [id]);
        await pool.query('DELETE FROM public.pedido_detalle WHERE id_producto = $1', [id]);
        await pool.query('DELETE FROM public.productos WHERE id_producto = $1', [id]);

        await pool.query('COMMIT');
        emitAdminEvent('products:changed', { action: 'deleted', id: parseInt(id) });
        res.json({ success: true, message: 'Producto eliminado exitosamente' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error DELETE /api/productos:', error.message);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

module.exports = router;
