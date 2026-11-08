export default async function globalTeardown() {
  const db = (globalThis as any).__MYSQL_DB__;
  if (db) await db.stop();
}
