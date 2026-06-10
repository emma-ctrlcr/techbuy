const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${parseInt(process.env.DB_PORT || '5432')}/${process.env.DB_NAME}`,
  max: 10,
  idleTimeoutMillis: 300000,
  connectionTimeoutMillis: 5000,
  ...(process.env.DATABASE_URL ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

pool.query('SELECT 1').catch(err => {
  console.error('Error pre-warming pool:', err.message);
});

module.exports = pool;
