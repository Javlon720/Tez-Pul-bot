'use strict';
import 'dotenv/config';
import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { errMessage, toInt } from './utils.js';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     toInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tezpulbot',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      toInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
});

pool.on('error', (err: Error) => console.error('[DB] Pool error:', err.message));

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

export async function transaction<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
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

export async function connectWithRetry(attempts = 0): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
    console.log('[DB] PostgreSQL ulandi');
  } catch (err) {
    if (attempts < 10) {
      const delay = Math.min((attempts + 1) * 1000, 5000);
      console.warn(`[DB] Ulanish xatosi (${attempts + 1}/10): ${errMessage(err)}. ${delay}ms dan so'ng qayta...`);
      await new Promise(r => setTimeout(r, delay));
      return connectWithRetry(attempts + 1);
    }
    console.error('[DB] Max urinishlar tugadi. Chiqilmoqda.');
    process.exit(1);
  }
}
