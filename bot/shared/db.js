'use strict';
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tezpulbot',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function transaction(cb) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function connectWithRetry(attempts = 0) {
  try {
    const client = await pool.connect();
    client.release();
    console.log('[DB] PostgreSQL ulandi');
  } catch (err) {
    if (attempts < 10) {
      const delay = Math.min((attempts + 1) * 1000, 5000);
      console.warn(`[DB] Ulanish xatosi (${attempts + 1}/10): ${err.message}. ${delay}ms dan so'ng qayta...`);
      await new Promise(r => setTimeout(r, delay));
      return connectWithRetry(attempts + 1);
    }
    console.error('[DB] Max urinishlar tugadi. Chiqilmoqda.');
    process.exit(1);
  }
}
