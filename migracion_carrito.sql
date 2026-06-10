-- ══════════════════════════════════════════════════════════════
-- TECHBUY — migracion_carrito.sql
-- Migración del carrito de compras a PostgreSQL.
-- Crea las tablas necesarias para persistir el carrito en backend.
-- ══════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.carritos (
    id_carrito    SERIAL PRIMARY KEY,
    id_usuario    INTEGER NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_carritos_usuario UNIQUE (id_usuario)
);

CREATE TABLE IF NOT EXISTS public.carrito_items (
    id_item       SERIAL PRIMARY KEY,
    id_carrito    INTEGER NOT NULL REFERENCES public.carritos(id_carrito) ON DELETE CASCADE,
    id_producto   INTEGER NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
    cantidad      INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_carrito_items_producto UNIQUE (id_carrito, id_producto)
);

CREATE INDEX IF NOT EXISTS idx_carrito_items_carrito ON public.carrito_items(id_carrito);

COMMIT;
