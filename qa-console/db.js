import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

export const db = new DatabaseSync(path.join(__dirname, 'data', 'console.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    suite TEXT,
    total INTEGER, passed INTEGER, failed INTEGER, skipped INTEGER, flaky INTEGER,
    duration_ms INTEGER,
    report_json TEXT
  )
`);

// la pornire: orice run 'running' din DB apartine unui proces anterior mort
export function markStaleRunsInterrupted() {
  db.prepare("UPDATE runs SET status='interrupted' WHERE status='running'").run();
}

export function startRun(suite) {
  const r = db.prepare('INSERT INTO runs (started_at, status, suite) VALUES (?, ?, ?)')
    .run(new Date().toISOString(), 'running', suite);
  return Number(r.lastInsertRowid);
}

export function finishRun(id, { suite, reportPath, exitCode }) {
  let report = null;
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { /* lipsa/invalid - il lasam null */ }
  const stats = report?.stats ?? {};
  const passed = (stats.expected ?? 0) + (stats.flaky ?? 0);
  const failed = (stats.unexpected ?? 0) + (stats.interrupted ?? 0);
  const skipped = stats.skipped ?? 0;
  db.prepare(`UPDATE runs SET finished_at=?, status=?, total=?, passed=?, failed=?, skipped=?, flaky=?, duration_ms=?, report_json=? WHERE id=?`)
    .run(new Date().toISOString(), exitCode === 0 ? 'passed' : 'failed',
      passed + failed + skipped, passed, failed, skipped, stats.flaky ?? 0,
      stats.duration ?? null, report ? JSON.stringify(report) : null, id);
}

export function listRuns(limit = 50) {
  return db.prepare(`SELECT id, started_at, finished_at, status, suite, total, passed, failed, skipped, flaky, duration_ms
                     FROM runs ORDER BY id DESC LIMIT ?`).all(limit);
}

export function deleteRunsBefore(id){
  return Number(db.prepare('DELETE FROM runs WHERE id < ?').run(id).changes);
}

export function getRun(id) {
  return db.prepare('SELECT * FROM runs WHERE id=?').get(id);
}
