-- ============================================================
--  migracion_timestamptz.sql
--  Corrige columnas DATE / TIMESTAMP → TIMESTAMPTZ
--  Las tablas se crearon con timestamp without time zone, pero
--  la migracion_techbuy.sql especifica TIMESTAMPTZ.
--
--  Los valores almacenados representan hora UTC (porque el
--  session timezone de postgres es GMT y se usó NOW()).
--  Se re-interpretan con AT TIME ZONE 'UTC'.
--
--  Idempotente: solo altera columnas que aún son TIMESTAMP.
--
--  psql -U postgres -d tbuy_db -f migracion_timestamptz.sql
-- ============================================================

DO $$
BEGIN
  -- ── pedidos.fecha ─────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='pedidos' AND column_name='fecha'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.pedidos
      ALTER COLUMN fecha TYPE TIMESTAMPTZ
      USING fecha AT TIME ZONE 'UTC';
  END IF;

  -- ── usuarios.fecha_registro ───────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='usuarios' AND column_name='fecha_registro'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.usuarios
      ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ
      USING fecha_registro AT TIME ZONE 'UTC';
  END IF;

  -- ── usuarios.updated_at ───────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='usuarios' AND column_name='updated_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.usuarios
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING updated_at AT TIME ZONE 'UTC';
    ALTER TABLE public.usuarios
      ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;

  -- ── productos.created_at ──────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='productos' AND column_name='created_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.productos
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  END IF;

  -- ── productos.updated_at ──────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='productos' AND column_name='updated_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.productos
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING updated_at AT TIME ZONE 'UTC';
    ALTER TABLE public.productos
      ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;

  -- ── carrusel_imagenes.created_at ──────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='carrusel_imagenes' AND column_name='created_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.carrusel_imagenes
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  END IF;

  -- ── carrusel_imagenes.updated_at ──────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='carrusel_imagenes' AND column_name='updated_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.carrusel_imagenes
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING updated_at AT TIME ZONE 'UTC';
    ALTER TABLE public.carrusel_imagenes
      ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;

  -- ── admins.created_at ────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='admins' AND column_name='created_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.admins
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  END IF;

  -- ── admins.updated_at ─────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='admins' AND column_name='updated_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.admins
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING updated_at AT TIME ZONE 'UTC';
    ALTER TABLE public.admins
      ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;

  -- ── cupones.created_at ────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='cupones' AND column_name='created_at'
             AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.cupones
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
    ALTER TABLE public.cupones
      ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;

  -- ── cupones.fecha_inicio (DATE → TIMESTAMPTZ) ────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='cupones' AND column_name='fecha_inicio'
             AND data_type='date') THEN
    ALTER TABLE public.cupones
      ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ
      USING (fecha_inicio::timestamp AT TIME ZONE 'America/Managua');
    ALTER TABLE public.cupones
      ALTER COLUMN fecha_inicio DROP DEFAULT;
  END IF;

  -- ── cupones.fecha_fin (DATE → TIMESTAMPTZ) ────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='cupones' AND column_name='fecha_fin'
             AND data_type='date') THEN
    ALTER TABLE public.cupones
      ALTER COLUMN fecha_fin TYPE TIMESTAMPTZ
      USING (fecha_fin::timestamp AT TIME ZONE 'America/Managua');
    ALTER TABLE public.cupones
      ALTER COLUMN fecha_fin DROP DEFAULT;
  END IF;

END $$;
