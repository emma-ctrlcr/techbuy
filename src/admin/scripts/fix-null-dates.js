const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function fixNullDates() {
    const client = await pool.connect();
    try {
        console.log('🔍 Buscando registros con fecha NULL...\n');

        // ── Pedidos ──
        const pedidos = await client.query(
            `UPDATE public.pedidos SET fecha = NOW() WHERE fecha IS NULL RETURNING id_pedido`
        );
        console.log(`✅ Pedidos corregidos: ${pedidos.rowCount}`);

        // ── Contactos (mensajes) ──
        const contactos = await client.query(
            `UPDATE public.contactos SET created_at = NOW() WHERE created_at IS NULL RETURNING id_contacto`
        );
        console.log(`✅ Mensajes corregidos: ${contactos.rowCount}`);

        // ── Productos ──
        const productos = await client.query(
            `UPDATE public.productos SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL RETURNING id_producto`
        );
        console.log(`✅ Productos corregidos: ${productos.rowCount}`);

        // ── Usuarios (web) ──
        const usuarios = await client.query(
            `UPDATE public.usuarios SET fecha_registro = NOW(), updated_at = NOW() WHERE fecha_registro IS NULL RETURNING id_usuario`
        );
        console.log(`✅ Usuarios web corregidos: ${usuarios.rowCount}`);

        // ── Admins ──
        const admins = await client.query(
            `UPDATE public.admins SET created_at = NOW() WHERE created_at IS NULL RETURNING id_admin`
        );
        console.log(`✅ Admins corregidos: ${admins.rowCount}`);

        // ── Carrusel ──
        const carrusel = await client.query(
            `UPDATE public.carrusel_imagenes SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL RETURNING id_imagen`
        );
        console.log(`✅ Carrusel corregidas: ${carrusel.rowCount}`);

        console.log('\n🎉 Todas las fechas NULL han sido corregidas.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixNullDates();
