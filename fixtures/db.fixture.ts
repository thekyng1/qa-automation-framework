import { createDB, type MySQLDB } from 'mysql-memory-server';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

let db: MySQLDB | undefined;

export default async function globalSetup() {
  db = await createDB({
    version: '8.4.x',
    dbName: 'app_test',
  });

  // Conectează-te la baza de date creată pentru a rula query-uri
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: db.port,
    user: db.username,
    password: '',
    database: db.dbName,
  });

  await connection.execute(`CREATE TABLE IF NOT EXISTS test_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await connection.end();

  const runtime = {
    host: '127.0.0.1',
    port: db.port,
    user: db.username,
    password: '',
    database: db.dbName,
  };
  fs.writeFileSync(path.join(__dirname, 'db-runtime.json'), JSON.stringify(runtime, null, 2));

  process.env.DB_HOST = runtime.host;
  process.env.DB_PORT = String(runtime.port);
  process.env.DB_USER = runtime.user;
  process.env.DB_NAME = runtime.database;

  (globalThis as any).__MYSQL_DB__ = db;
}
