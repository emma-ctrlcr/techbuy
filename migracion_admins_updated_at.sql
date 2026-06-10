-- migracion_admins_updated_at.sql
-- Agrega columna updated_at a public.admins si no existe (idempotente)
-- Ejecutar: \i migracion_admins_updated_at.sql  (psql)
-- O pegar en el query editor de pgAdmin / DBeaver

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admins' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.admins ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
