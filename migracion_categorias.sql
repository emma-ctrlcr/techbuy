-- ============================================================
--  TECHBUY — migracion_categorias.sql
--  Normaliza categorías: 11 canónicas con orden, iconos, slugs.
--
--  psql -U postgres -d tbuy_db -f migracion_categorias.sql
-- ============================================================

BEGIN;

ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS orden INT DEFAULT 0;

-- Actualizar categorías existentes (se conserva id_categoria para FK)
UPDATE public.categorias SET key='oficina',     nombre='Oficina',     icon='fa-briefcase',     orden=10 WHERE key='oficina'     OR (key IS NULL AND nombre ILIKE 'oficina');
UPDATE public.categorias SET key='hogar',       nombre='Hogar',       icon='fa-house',         orden=8  WHERE key='hogar'       OR (key IS NULL AND nombre ILIKE 'hogar');
UPDATE public.categorias SET key='gamer',       nombre='Gamer',       icon='fa-gamepad',       orden=7  WHERE key='gamer'       OR (key IS NULL AND nombre ILIKE 'gamer');
UPDATE public.categorias SET key='computacion', nombre='Computación', icon='fa-laptop',        orden=6  WHERE key='computacion' OR (key IS NULL AND nombre ILIKE 'computac%');
UPDATE public.categorias SET key='celulares',   nombre='Celulares',   icon='fa-mobile-screen', orden=5  WHERE key='celulares'   OR (key IS NULL AND nombre ILIKE 'celulares');
UPDATE public.categorias SET key='otros',       nombre='Otros',       icon='fa-box-open',      orden=11 WHERE key='otros'       OR (key IS NULL AND nombre ILIKE 'otros');

-- Insertar nuevas categorías si no existen ya por key
INSERT INTO public.categorias (key, nombre, icon, orden)
SELECT d.key, d.nombre, d.icon, d.orden
FROM (VALUES
  ('adaptadores'::varchar, 'Adaptadores'::varchar, 'fa-plug'::varchar, 1::int),
  ('audio',       'Audio',       'fa-headphones',       2),
  ('baterias',    'Baterías',    'fa-battery-full',     3),
  ('cargadores',  'Cargadores',  'fa-charging-station', 4),
  ('mochilas',    'Mochilas',    'fa-bag-shopping',     9)
) AS d(key, nombre, icon, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.key = d.key OR c.nombre = d.nombre);

COMMIT;
