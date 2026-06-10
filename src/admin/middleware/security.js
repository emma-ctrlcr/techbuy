const { body, validationResult, query, param } = require('express-validator');

/* ── Sanitize all string inputs in req.body, req.query, req.params ── */
function sanitizeInput(req, res, next) {
    const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].trim().replace(/[<>]/g, '');
            } else if (typeof obj[key] === 'object') {
                walk(obj[key]);
            }
        }
    };
    walk(req.body);
    walk(req.query);
    next();
}

/* ── Check validation result middleware ── */
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Datos inválidos',
            details: errors.array().map(e => e.msg),
        });
    }
    next();
}

/* ── Product validation rules ── */
const productRules = [
    body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('descripcion').trim().notEmpty().withMessage('La descripción es requerida'),
    body('precio_original').isFloat({ min: 0.01 }).withMessage('Precio original debe ser mayor a 0'),
    body('stock').isInt({ min: 1 }).withMessage('Stock debe ser un número entero >= 1'),
    body('categoria').trim().notEmpty().withMessage('Categoría es requerida'),
    handleValidation,
];

/* ── Login validation ── */
const loginRules = [
    body('username').trim().notEmpty().withMessage('Usuario es requerido'),
    body('password').notEmpty().withMessage('Contraseña es requerida'),
    body('carnet').trim().notEmpty().withMessage('Carnet es requerido'),
    handleValidation,
];

/* ── Admin user validation ── */
const adminUserRules = [
    body('username').trim().notEmpty().withMessage('Usuario es requerido'),
    body('password').isLength({ min: 8 }).withMessage('Contraseña debe tener al menos 8 caracteres'),
    body('carnet').trim().notEmpty().withMessage('Carnet es requerido'),
    handleValidation,
];

/* ── Message validation (public) ── */
const messageRules = [
    body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('mensaje').trim().notEmpty().withMessage('Mensaje es requerido'),
    handleValidation,
];

/* ── ID param validation ── */
const idParam = [
    param('id').isInt({ min: 1 }).withMessage('ID inválido'),
    handleValidation,
];

module.exports = {
    sanitizeInput,
    handleValidation,
    productRules,
    loginRules,
    adminUserRules,
    messageRules,
    idParam,
};
