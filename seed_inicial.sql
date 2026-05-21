-- ============================================================
--  TECHBUY — seed_inicial.sql
--  Datos iniciales para tablas nuevas creadas en la migración.
--  Ejecutar UNA sola vez después de aplicar migracion_techbuy.sql
-- ============================================================

BEGIN;

-- ── Costos de envío por departamento ─────────────────────────
INSERT INTO public.envios_departamento (departamento, costo, activo)
VALUES
  ('Managua',    60,  true),
  ('Masaya',     80,  true),
  ('Granada',    90,  true),
  ('Carazo',     90,  true),
  ('León',       120, true),
  ('Chinandega', 140, true),
  ('Rivas',      130, true),
  ('Boaco',      120, true),
  ('Chontales',  150, true),
  ('Matagalpa',  140, true),
  ('Jinotega',   160, true),
  ('Estelí',     150, true),
  ('Madriz',     170, true),
  ('Nueva Segovia', 180, true),
  ('Río San Juan',  220, true),
  ('Región Autónoma de la Costa Caribe Norte', 320, true),
  ('Región Autónoma de la Costa Caribe Sur',   350, true)
ON CONFLICT (departamento) DO NOTHING;

-- ── Cupones de descuento ──────────────────────────────────────
INSERT INTO public.cupones (codigo, descuento, activo, usos_max, fecha_inicio)
VALUES
  ('TECHBUY10',  0.10, true, NULL, CURRENT_DATE),
  ('OFERTA15',   0.15, true, NULL, CURRENT_DATE),
  ('BIENVENIDO', 0.05, true, 1,    CURRENT_DATE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Método de pago base (tarjeta) ─────────────────────────────
-- Sólo si la tabla metodos_pago existe y está vacía
INSERT INTO public.metodos_pago (nombre)
SELECT 'Tarjeta de crédito/débito'
WHERE NOT EXISTS (
  SELECT 1 FROM public.metodos_pago WHERE nombre = 'Tarjeta de crédito/débito'
);

COMMIT;
