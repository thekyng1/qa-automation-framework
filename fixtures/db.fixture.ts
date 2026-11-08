/**
 * Playwright globalSetup:
 *   1. starts an ephemeral MySQL instance (mysql-memory-server, real mysqld)
 *   2. applies schema + seed data (fixtures/db.schema.ts)
 *   3. launches the demo application (test-app/server.js) with DB env vars
 *   4. waits until the app answers /health
 *   5. exports connection info via process.env — no db-runtime.json handoff
 *
 * Started processes are stopped by fixtures/db.teardown.ts.
 */
import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { createDB, type MySQLDB } from 'mysql-memory-server';
import mysql from 'mysql2/promise';
import { SCHEMA_SQL, SEED_SQL } from './db.schema';
import { dbConfigFromEnv } from '../utils/db';

const APP_PORT = Number(process.env.APP_PORT || 3100);

async function waitForApp(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${APP_PORT}/health`);
      if (res.ok) return;
    } catch {
      // app not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`test-app did not answer /health on port ${APP_PORT} within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const db: MySQLDB = await createDB({ version: '8.4.x', dbName: 'app_test' });

  const runtime = {
    host: '127.0.0.1',
    port: db.port,
    user: db.username,
    password: '',
    database: db.dbName,
  };

  process.env.DB_HOST = runtime.host;
  process.env.DB_PORT = String(runtime.port);
  process.env.DB_USER = runtime.user;
  process.env.DB_PASSWORD = runtime.password;
  process.env.DB_NAME = runtime.database;

  const conn = await mysql.createConnection({ multipleStatements: true, ...dbConfigFromEnv() });
  try {
    await conn.query(SCHEMA_SQL);
    await conn.query(SEED_SQL);
  } finally {
    await conn.end();
  }

  // Launch the system under test with the DB coordinates in its environment.
  const app: ChildProcess = spawn(process.execPath, [path.join(__dirname, '..', 'test-app', 'server.js')], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout!.on('data', (d) => process.stdout.write(`[test-app] ${d}`));
  app.stderr!.on('data', (d) => process.stderr.write(`[test-app] ${d}`));

  await waitForApp();

  (globalThis as any).__MYSQL_DB__ = db;
  (globalThis as any).__TEST_APP__ = app;
}
