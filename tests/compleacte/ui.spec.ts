import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită UI pentru CompleActe (Capacitor WebView = pagină web normală).
 * App-ul e servit de un server static pornit/oprit de suită (port aleator,
 * nimic permanent, nimic systemd nou).
 *
 * www/ NU e în repo: index.html conține o cheie API hardcodată.
 * Pe server: /opt/qa/compleacte-www (copie din /root/proiecte/www).
 * Override: COMPLEACTE_WWW=/cale npx playwright test tests/compleacte
 * Dacă folderul lipsește (CI), testele fac SKIP — nu FAIL.
 */
const APP_DIR = process.env.COMPLEACTE_WWW || '/opt/qa/compleacte-www';
const APP_MISSING = !fs.existsSync(path.join(APP_DIR, 'index.html'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.pdf': 'application/pdf', '.ttf': 'font/ttf',
};

let server: http.Server | null = null;
let appUrl = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const file = path.join(APP_DIR, rel === '/' ? 'index.html' : path.normalize(rel));
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>(r => (server as http.Server).listen(0, '127.0.0.1', r));
  appUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  if (server) await new Promise(r => server!.close(() => r(null)));
});

test.describe('CompleActe', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);

test('health: pagina principală se încarcă', async ({ page }) => {
    await page.goto(appUrl + '/');
    await expect(page).toHaveTitle(/CompleActe/);
    await expect(page.locator('header h1')).toContainText('CompleActe');
  });

test('smoke: selectorul de formulare se populează din registry', async ({ page }) => {
    await page.goto(appUrl + '/');
    await expect.poll(async () =>
      page.locator('#selector-formular option').count(), { timeout: 10_000 }
    ).toBeGreaterThan(0);
  });

test('flux: acord bifat → Continuă → ecranul 2 (Date)', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('#acord').check();
    await page.locator('button:has-text("Continuă")').click();
    await expect(page.locator('#s2')).toBeVisible();
  });

test('negativ: fără acord, rămâi pe ecranul 1', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('button:has-text("Continuă")').click();
    await expect(page.locator('#s1')).toBeVisible();
    await expect(page.locator('#s2')).toBeHidden();
  });
});
