import pg from 'pg';
let pool;
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('Database not configured');
  pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 10000 });
  return pool;
}
