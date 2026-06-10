function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeFields(obj, fields) {
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = fields.includes(key) && typeof obj[key] === 'string' ? stripHtml(obj[key]) : obj[key];
  }
  return out;
}

const COMMON_TEXT_FIELDS = ['nombre', 'apellido', 'username', 'address', 'city', 'dept', 'asunto', 'mensaje', 'alias', 'brand'];

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeFields(req.body, COMMON_TEXT_FIELDS);
  }
  next();
}

module.exports = { stripHtml, sanitizeFields, sanitizeBody, COMMON_TEXT_FIELDS };
