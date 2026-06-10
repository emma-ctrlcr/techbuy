BEGIN;

-- Reasignar productos que apuntan a categorias duplicadas
UPDATE public.productos SET id_categoria = 11 WHERE id_categoria IN (6);
UPDATE public.productos SET id_categoria = 14 WHERE id_categoria IN (9);
UPDATE public.productos SET id_categoria = 12 WHERE id_categoria IN (7);

-- Eliminar filas duplicadas
DELETE FROM public.categorias WHERE id_categoria IN (6,7,8,9,10);

-- Asegurar orden correcto en las que se quedan
UPDATE public.categorias SET orden=1,  icon='fa-plug'             WHERE key='adaptadores';
UPDATE public.categorias SET orden=2,  icon='fa-headphones'       WHERE key='audio';
UPDATE public.categorias SET orden=3,  icon='fa-battery-full'     WHERE key='baterias';
UPDATE public.categorias SET orden=4,  icon='fa-charging-station' WHERE key='cargadores';
UPDATE public.categorias SET orden=5,  icon='fa-mobile-screen'    WHERE key='celulares';
UPDATE public.categorias SET orden=6,  icon='fa-laptop'           WHERE key='computacion';
UPDATE public.categorias SET orden=7,  icon='fa-gamepad'          WHERE key='gamer';
UPDATE public.categorias SET orden=8,  icon='fa-house'            WHERE key='hogar';
UPDATE public.categorias SET orden=9,  icon='fa-bag-shopping'     WHERE key='mochilas';
UPDATE public.categorias SET orden=10, icon='fa-briefcase'        WHERE key='oficina';
UPDATE public.categorias SET orden=11, icon='fa-box-open'         WHERE key='otros';

COMMIT;
