import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRun, finishRun, listRuns, getRun, markStaleRunsInterrupted, deleteRunsBefore } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FW_DIR = '/opt/qa/qa-automation-framework';
const REPORT = path.join(FW_DIR, 'playwright-report.json');
const PORT = 3200;

const app = express();
markStaleRunsInterrupted(); // rularile orfane de la procesul anterior devin 'interrupted'

// curățenie automată: păstrează max 50 de run-uri în istoric
const allRuns = listRuns(51);
if (allRuns.length > 50) {
  const cutId = allRuns[49].id; // al 50-lea cel mai recent — tot ce e mai vechi dispare
  const deleted = deleteRunsBefore(cutId);
  console.log(`curățenie la boot: șterse ${deleted} run-uri (păstrate cele mai recente 50)`);
}
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/report', express.static('/opt/qa/qa-automation-framework/playwright-report'));

let current = null;

// ---- best-effort: extrage ultimul {"answer":"..."} din log-uri/ataseamente
function extractAI(raw) {
  if (!raw) return null;
  const m = String(raw).match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try { return JSON.parse('{"answer":"' + m[1] + '"}').answer; } catch { return m[1]; }
}

function collectTests(report) {
  const tests = [];
  const walk = suites => (suites || []).forEach(s => {
    (s.specs || []).forEach(spec => (spec.tests || []).forEach(t => {
      const r = (t.results || []).slice(-1)[0] || {};
      const blob = [
        ...(r.stdout || []).map(c => c.text || ''),
        ...(r.attachments || []).map(a => a.body ? Buffer.from(a.body, 'base64').toString('utf8') : '')
      ].join('\n');
      const entry = { title: spec.title, project: t.projectName, status: t.status, duration: r.duration ?? null };
      const ai = extractAI(blob);
      if (ai) entry.ai = ai;
      tests.push(entry);
    }));
    walk(s.suites);
  });
  walk(report?.suites);
  return tests;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, busy: !!current }));
app.get('/api/runs', (req, res) => res.json(listRuns(Number(req.query.limit) || 50)));

app.delete('/api/runs/before/:id',(req,res)=>{
  if(current) return res.status(409).json({error:'exista deja o rulare in curs'});
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<=1) return res.status(400).json({error:'id invalid'});
  res.json({deleted:deleteRunsBefore(id)});
});

app.get('/api/runs/:id/summary', (req, res) => {
  const run = getRun(Number(req.params.id));
  if (!run) return res.status(404).json({ error: 'run inexistent' });
  let report = null; try { report = JSON.parse(run.report_json); } catch {}
  res.json({ id: run.id, status: run.status, tests: collectTests(report) });
});

app.post('/api/run', (req, res) => {
  if (current) return res.status(409).json({ error: 'exista deja o rulare in curs' });
  const suite = ['tests/ai', 'tests/orders-api.spec.ts', 'all'].includes(req.body?.suite) ? req.body.suite : 'tests/ai';
  const id = startRun(suite);
  const child = spawn('npx', ['playwright', 'test', ...(suite === 'all' ? [] : [suite])], { cwd: FW_DIR });
  current = { child, id };
  child.on('close', code => { finishRun(id, { suite, reportPath: REPORT, exitCode: code }); current = null; });
  child.on('error', () => { finishRun(id, { suite, reportPath: REPORT, exitCode: 1 }); current = null; });
  res.json({ id, suite });
});

app.listen(PORT, '127.0.0.1', () => console.log(`QA Console v2 pe 127.0.0.1:${PORT} (localhost-only)`));
