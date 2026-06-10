-- ============================================================
-- TechBuy Store — Optimización de Índices PostgreSQL
-- Generado: 2026-05-29
-- ============================================================

-- 1. Extensión para búsqueda textual con trigramas
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Tabla: productos (7 índices)
-- ============================================================

-- I1: ORDER BY created_at DESC (Q1 default sort)
CREATE INDEX IF NOT EXISTS idx_productos_created_at
  ON public.productos (created_at DESC);

-- I3: Filtro por categoría + ORDER BY (Q1 cat filter, Q3)
CREATE INDEX IF NOT EXISTS idx_productos_categoria_created
  ON public.productos (id_categoria, created_at DESC);

-- I4: Filtro por precio + ORDER BY (Q1 price filter)
CREATE INDEX IF NOT EXISTS idx_productos_precio_created
  ON public.productos (precio, created_at DESC);

-- I6: Filtro por badge (Q1, Q6)
CREATE INDEX IF NOT EXISTS idx_productos_badge
  ON public.productos (badge);

-- I7: Stock bajo para alertas (Q5, parcial)
CREATE INDEX IF NOT EXISTS idx_productos_stock_alerta
  ON public.productos (stock) WHERE activo = true;

-- I5a: Búsqueda textual por nombre (Q1 ILIKE)
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON public.productos USING gin (nombre gin_trgm_ops);

-- I5b: Búsqueda textual por marca (Q1, Q6 ILIKE)
CREATE INDEX IF NOT EXISTS idx_productos_brand_trgm
  ON public.productos USING gin (brand gin_trgm_ops);

-- ============================================================
-- 3. Tabla: imagenes_producto (1 índice)
-- ============================================================

-- I2: JOIN con productos (Q7, usado en Q1/Q3/Q4)
CREATE INDEX IF NOT EXISTS idx_imagenes_producto_id
  ON public.imagenes_producto (id_producto);

-- ============================================================
-- 4. Tabla: categorias (1 índice)
-- ============================================================

-- I8: ORDER BY orden, nombre (Q9, Q10)
CREATE INDEX IF NOT EXISTS idx_categorias_orden_nombre
  ON public.categorias (orden, nombre);

-- ============================================================
-- 5. Tabla: favoritos (1 índice)
-- ============================================================

-- I9: Filtro por usuario + ORDER BY fecha (Q8)
CREATE INDEX IF NOT EXISTS idx_favoritos_id_usuario
  ON public.favoritos (id_usuario, created_at DESC);
