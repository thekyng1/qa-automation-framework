import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

export type Where = Record<string, unknown>;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function dbConfigFromEnv(): DbConfig {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
      'DB_HOST, DB_USER and DB_NAME must be set. They are injected by globalSetup (fixtures/db.fixture.ts).',
    );
  }
  return {
    host: DB_HOST,
    port: Number(DB_PORT ?? 3306),
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
  };
}

/**
 * One connection per test/worker — never one connection per query.
 * All queries are parameterized: table and column names go through `??`
 * escaping, values through `?` placeholders. Zero string interpolation.
 */
export async function getDbConnection(): Promise<Connection> {
  return mysql.createConnection(dbConfigFromEnv());
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  conn: Connection,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await conn.query<T[]>(sql, params);
  return rows;
}

export async function findOne<T extends RowDataPacket = RowDataPacket>(
  conn: Connection,
  table: string,
  where: Where,
): Promise<T | undefined> {
  const keys = Object.keys(where);
  if (keys.length === 0) throw new Error('findOne requires at least one WHERE condition');
  const sql = `SELECT * FROM ?? WHERE ${keys.map(() => '?? = ?').join(' AND ')} LIMIT 1`;
  const rows = await query<T>(conn, sql, [table, ...keys.flatMap((k) => [k, where[k]])]);
  return rows[0];
}

export async function count(conn: Connection, table: string, where: Where): Promise<number> {
  const keys = Object.keys(where);
  if (keys.length === 0) throw new Error('count requires at least one WHERE condition');
  const sql = `SELECT COUNT(*) AS total FROM ?? WHERE ${keys.map(() => '?? = ?').join(' AND ')}`;
  const rows = await query(conn, sql, [table, ...keys.flatMap((k) => [k, where[k]])]);
  return Number((rows[0] as { total: number }).total);
}
