import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const runtime = JSON.parse(fs.readFileSync(path.join(__dirname, 'db-runtime.json'), 'utf-8'));
  const conn = await mysql.createConnection(runtime);
  try {
    const [rows] = await conn.execute(sql, params);
    return rows as T[];
  } finally {
    await conn.end();
  }
}
