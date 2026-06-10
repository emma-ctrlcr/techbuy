-- ============================================================
--  TECHBUY — migracion_techbuy.sql
--  Crear todas las tablas desde cero.
--  Ejecutar UNA sola vez antes de seed_inicial.sql
--
--  psql -U postgres -d tbuy_db -f migracion_techbuy.sql
-- ============================================================

BEGIN;

-- ── Categorías ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias (
  id_categoria SERIAL PRIMARY KEY,
  key          VARCHAR(50)  UNIQUE NOT NULL,  -- slug: 'gamer', 'oficina', etc.
  nombre       VARCHAR(100) NOT NULL,
  icon         VARCHAR(100),                  -- clase FontAwesome
  activo       BOOLEAN DEFAULT TRUE,
  orden        INT DEFAULT 0
);

-- ── Productos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productos (
  id_producto    SERIAL PRIMARY KEY,
  id_categoria   INT REFERENCES public.categorias(id_categoria),
  nombre         VARCHAR(200) NOT NULL,
  descripcion    TEXT,
  precio         NUMERIC(10,2) NOT NULL,
  precio_anterior NUMERIC(10,2),
  descuento      NUMERIC(5,2) DEFAULT 0,
  stock          INT          DEFAULT 1 CHECK (stock >= 1),
  brand          VARCHAR(100),
  badge          VARCHAR(20),                 -- 'new' | 'sale'
  activo         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Imágenes de producto ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imagenes_producto (
  id_imagen   SERIAL PRIMARY KEY,
  url         TEXT NOT NULL,
  id_producto INT NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE
);

-- ── Usuarios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id_usuario      SERIAL PRIMARY KEY,
  username        VARCHAR(100),
  email           VARCHAR(200) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,      -- bcrypt hash
  nombre          VARCHAR(100),
  apellido        VARCHAR(100),
  tel             VARCHAR(20),
  address         TEXT,
  city            VARCHAR(100),
  activo          BOOLEAN DEFAULT TRUE,
  fecha_registro  TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Añadir updated_at si la tabla ya fue creada sin ella (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='updated_at') THEN
    ALTER TABLE public.usuarios ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='rol') THEN
    ALTER TABLE public.usuarios ADD COLUMN rol VARCHAR(20) DEFAULT 'user';
  END IF;
END $$;

-- ── Refresh tokens para auth JWT ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id          SERIAL PRIMARY KEY,
  id_usuario  INT NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  token       VARCHAR(500) NOT NULL,
  family      VARCHAR(50) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON public.refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON public.refresh_tokens(family);

-- ── Favoritos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favoritos (
  id_favorito  SERIAL PRIMARY KEY,
  id_usuario   INT NOT NULL REFERENCES public.usuarios(id_usuario)  ON DELETE CASCADE,
  id_producto  INT NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_usuario, id_producto)
);

-- ── Cupones ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cupones (
  id_cupon     SERIAL PRIMARY KEY,
  codigo       VARCHAR(50) UNIQUE NOT NULL,
  descuento    NUMERIC(5,4) NOT NULL,         -- 0.10 = 10%
  activo       BOOLEAN DEFAULT TRUE,
  usos_max     INT,                           -- NULL = ilimitado
  usos_actual  INT DEFAULT 0,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin    TIMESTAMPTZ
);

-- ── Métodos de pago guardados por usuario ─────────────────────
CREATE TABLE IF NOT EXISTS public.metodos_pago_usuario (
  id          SERIAL PRIMARY KEY,
  id_usuario  INT NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  alias       VARCHAR(100),                   -- 'Visa *4242'
  tipo        VARCHAR(30) DEFAULT 'card',     -- 'visa' | 'mastercard' | 'amex'
  ultimos4    CHAR(4) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pedidos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedidos (
  id_pedido          SERIAL PRIMARY KEY,
  id_usuario         INT NOT NULL REFERENCES public.usuarios(id_usuario),
  id_metodo_usuario  INT REFERENCES public.metodos_pago_usuario(id),
  total              NUMERIC(10,2) NOT NULL,
  discount           NUMERIC(10,2) DEFAULT 0,
  dept               VARCHAR(100),
  city               VARCHAR(100),
  status             VARCHAR(30) DEFAULT 'pagado',
  pdf_url            TEXT,
  fecha              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Detalle de pedido ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedido_detalle (
  id_detalle       SERIAL PRIMARY KEY,
  id_pedido        INT NOT NULL REFERENCES public.pedidos(id_pedido) ON DELETE CASCADE,
  id_producto      INT NOT NULL REFERENCES public.productos(id_producto),
  cantidad         INT NOT NULL,
  precio_unitario  NUMERIC(10,2) NOT NULL,
  brand            VARCHAR(100)
);

-- ── Envíos por departamento ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.envios_departamento (
  id_envio      SERIAL PRIMARY KEY,
  departamento  VARCHAR(100) UNIQUE NOT NULL,
  costo         NUMERIC(10,2) NOT NULL,
  activo        BOOLEAN DEFAULT TRUE
);

-- ── Admins (módulo admin) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admins (
  id_admin   SERIAL PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  carnet     VARCHAR(20)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Carrusel / Hero ───────────────────────────────────────────
-- Columnas unificadas: ambos módulos usan id_imagen, url, activo, created_at
CREATE TABLE IF NOT EXISTS public.carrusel_imagenes (
  id_imagen  SERIAL PRIMARY KEY,
  url        TEXT NOT NULL,
  activo     BOOLEAN DEFAULT TRUE,
  titulo     VARCHAR(200) DEFAULT '',
  subtitulo  TEXT DEFAULT '',
  btn_texto  VARCHAR(100) DEFAULT 'Ver Ofertas',
  btn_url    VARCHAR(500) DEFAULT 'ofertas.html',
  orden      INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas faltantes si la tabla ya existe (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrusel_imagenes' AND column_name='titulo') THEN
    ALTER TABLE public.carrusel_imagenes ADD COLUMN titulo VARCHAR(200) DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrusel_imagenes' AND column_name='subtitulo') THEN
    ALTER TABLE public.carrusel_imagenes ADD COLUMN subtitulo TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrusel_imagenes' AND column_name='btn_texto') THEN
    ALTER TABLE public.carrusel_imagenes ADD COLUMN btn_texto VARCHAR(100) DEFAULT 'Ver Ofertas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrusel_imagenes' AND column_name='btn_url') THEN
    ALTER TABLE public.carrusel_imagenes ADD COLUMN btn_url VARCHAR(500) DEFAULT 'ofertas.html';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrusel_imagenes' AND column_name='updated_at') THEN
    ALTER TABLE public.carrusel_imagenes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Asegurar columna updated_at en admins (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='updated_at') THEN
    ALTER TABLE public.admins ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
--  MIGRACIONES POSTERIORES (ejecutar en orden si ya se crearon
--  las tablas con el schema original)
-- ══════════════════════════════════════════════════════════════

-- Migrar cupones: DATE → TIMESTAMPTZ (idempotente)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cupones' AND column_name='fecha_inicio' AND data_type='date') THEN
    ALTER TABLE public.cupones ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ USING (fecha_inicio::timestamp AT TIME ZONE 'America/Managua');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cupones' AND column_name='fecha_fin' AND data_type='date') THEN
    ALTER TABLE public.cupones ALTER COLUMN fecha_fin TYPE TIMESTAMPTZ USING (fecha_fin::timestamp AT TIME ZONE 'America/Managua');
  END IF;
END $$;

-- ── Datos iniciales: categorías ───────────────────────────────
INSERT INTO public.categorias (key, nombre, icon, orden) VALUES
  ('adaptadores', 'Adaptadores', 'fa-plug',              1),
  ('audio',       'Audio',       'fa-headphones',        2),
  ('baterias',    'Baterías',    'fa-battery-full',      3),
  ('cargadores',  'Cargadores',  'fa-charging-station',  4),
  ('celulares',   'Celulares',   'fa-mobile-screen',     5),
  ('computacion', 'Computación', 'fa-laptop',            6),
  ('gamer',       'Gamer',       'fa-gamepad',           7),
  ('hogar',       'Hogar',       'fa-house',             8),
  ('mochilas',    'Mochilas',    'fa-bag-shopping',      9),
  ('oficina',     'Oficina',     'fa-briefcase',         10),
  ('otros',       'Otros',       'fa-box-open',          11)
ON CONFLICT (key) DO NOTHING;

-- ── Datos iniciales: productos ────────────────────────────────
INSERT INTO public.productos (id_categoria, nombre, precio, precio_anterior, stock, brand, badge) VALUES
  ((SELECT id_categoria FROM public.categorias WHERE key='oficina'), 'Monitor LG UltraGear 27" 4K',   449, 549, 10, 'LG',        'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='oficina'), 'Dell U2722D UltraSharp 27"',     449, 549,  9, 'Dell',      'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='oficina'), 'Teclado Logitech MX Keys',       99,  119, 22, 'Logitech',  'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='oficina'), 'Apple Magic Keyboard',           99,  NULL,14, 'Apple',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='oficina'), 'Ratón Microsoft Arc Mouse',      49,  79,  45, 'Microsoft', 'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='hogar'),   'JBL Flip 6 Bluetooth',           129, NULL,40, 'JBL',       'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='hogar'),   'Bose SoundLink Flex',            149, 179, 16, 'Bose',      'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='hogar'),   'Sony WH-1000XM5',                349, 399, 20, 'Sony',      'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='hogar'),   'Webcam Logitech C920 HD Pro',    79,  99,  30, 'Logitech',  'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='hogar'),   'Webcam Razer Kiyo X',            69,  NULL,25, 'Razer',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='gamer'),   'Ratón Razer DeathAdder V3',      69,  NULL,30, 'Razer',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='gamer'),   'Ratón Corsair Harpoon RGB',      39,  NULL,38, 'Corsair',   'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='gamer'),   'Teclado Corsair K65 RGB TKL',    119, 149, 20, 'Corsair',   'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='gamer'),   'Teclado Razer BlackWidow V4',    159, 189, 15, 'Razer',     'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='gamer'),   'HyperX Cloud III Gaming',        89,  109, 22, 'HyperX',    'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='computacion'), 'HP ProBook X15',             649, 799, 12, 'HP',        'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='computacion'), 'MacBook Air M3 15"',        1199,1299,  6, 'Apple',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='computacion'), 'Lenovo ThinkPad E16',        799, 949,  9, 'Lenovo',    'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='computacion'), 'ASUS VivoBook 14"',          549, NULL,18, 'ASUS',      'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='computacion'), 'Dell Inspiron 16"',          699, 849, 14, 'Dell',      'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='celulares'),   'Samsung Galaxy S24 Ultra',  1299,1399, 15, 'Samsung',   'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='celulares'),   'iPhone 15 Pro Max',         1199,NULL, 20, 'Apple',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='celulares'),   'Google Pixel 8 Pro',         999,1099, 18, 'Google',    'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='celulares'),   'Xiaomi 14 Ultra',            899, NULL,22, 'Xiaomi',    'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='celulares'),   'OnePlus 12',                 799, 899, 14, 'OnePlus',   'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Samsung Monitor Curvo 32"',      699, 849,  8, 'Samsung',   'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'ASUS ProArt PA279CV 27"',        349, NULL,12, 'ASUS',      'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'SteelSeries Rival 3',            45,  59,  28, 'SteelSeries','sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Teclado Keychron K2 HE',         89,  NULL,18, 'Keychron',  'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Ratón Logitech G502 HERO',       79,  99,  25, 'Logitech',  'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'SteelSeries Arctis Nova Pro',    349, 399, 14, 'SteelSeries','sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Apple AirPods Pro 2',            249, 279, 35, 'Apple',     'sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Hub USB-C Anker 7 en 1',         39,  NULL,40, 'Anker',     'new'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'Ratón SteelSeries Aerox 3',      55,  69,  32, 'SteelSeries','sale'),
  ((SELECT id_categoria FROM public.categorias WHERE key='otros'),   'AOC CQ27G2 Curvo 27"',           249, 299, 16, 'AOC',       'sale')
ON CONFLICT DO NOTHING;

-- ── Productos sin imágenes (auditoría manual) ──────────────────
-- SELECT p.id_producto, p.nombre FROM public.productos p
-- LEFT JOIN public.imagenes_producto ip ON ip.id_producto = p.id_producto
-- WHERE ip.id_imagen IS NULL AND p.activo = true;
--
-- Para corregir, agregue imágenes a esos productos o desactívelos:
-- UPDATE public.productos SET activo = false WHERE id_producto = <id>;

-- ── Stock constraint audit (run manually on existing DB) ─────────
-- SELECT id_producto, nombre, stock FROM public.productos WHERE stock <= 0;
-- Después de corregir los productos con stock <= 0, ejecutar:
-- ALTER TABLE public.productos ADD CONSTRAINT stock_minimo CHECK (stock >= 1);
-- NOTA: La línea "stock INT DEFAULT 1 CHECK (stock >= 1)" arriba aplica
--       para instalaciones nuevas. En DB existentes, revise y ejecute
--       manualmente los comandos de arriba.

-- ── Coupon audit: auto-desactivar cupones vencidos ──────────────
-- Ejecutar manualmente en DB existentes para corregir cupones
-- que tienen fecha_fin < NOW() pero aún están marcados como activos:
-- UPDATE public.cupones SET activo = FALSE
-- WHERE activo = TRUE AND fecha_fin IS NOT NULL AND fecha_fin < NOW();
-- SELECT id_cupon, codigo, fecha_fin, activo FROM public.cupones
-- WHERE fecha_fin IS NOT NULL AND fecha_fin < NOW() ORDER BY fecha_fin;

COMMIT;
