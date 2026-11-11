import { test, expect, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită UI pentru ecranul 2 «Date» din CompleActe.
 * Selectorii sunt cei reali, citiți din index.html (2026-11-11):
 *  - câmpurile sunt generate dinamic în #form-container; ținta lor e atributul [data-pdf];
 *  - valideaza() (index.html ~linia 120) definește lista câmpurilor obligatorii;
 *  - navigarea spre ecranul 3 se face prin laVerificare() (index.html linia 116)
 *    — dar vezi DEFECT-001: nicio bucată de cod nu o apelează.
 *
 * Serverul static e identic cu cel din ui.spec.ts (port aleator, nimic permanent).
 * www/ NU e în repo (cheie API hardcodată în index.html).
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
  if (server) await new Promise(r => (server as http.Server).close(() => r(null)));
});

/** Chei obligatorii conform valideaza() din index.html. */
const CHEI_OBLIGATORII = [
  'v_nume', 'v_cnp', 'v_telefon',
  'c_nume', 'c_cnp', 'c_telefon',
  'm_marca', 'm_nr_inmatriculare', 'm_vin',
  'pret_cifre', 'pret_litere', 'contract_loc', 'contract_data',
] as const;

/** Aceleași greutăți ca în validCNP() din index.html. */
const GREUTATI_CNP = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

/** Generează un CNP valid cu algoritmul aplicației (cifră de control calculată, nu hardcodată). */
function cnpValid(baza12: string): string {
  if (!/^\d{12}$/.test(baza12)) throw new Error('baza12 trebuie să aibă exact 12 cifre');
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(baza12[i]) * GREUTATI_CNP[i];
  const cd = s % 11;
  return baza12 + String(cd === 10 ? 1 : cd);
}

/** Navighează exact ca utilizatorul real: acord → Continuă → așteaptă randarea formularului. */
async function ecranDate(page: Page) {
  await page.goto(appUrl + '/');
  await page.locator('#acord').check();
  await page.locator('button:has-text("Continuă")').click();
  await expect(page.locator('#s2')).toBeVisible();
  await expect.poll(async () =>
    page.locator('#form-container [data-pdf]').count(), { timeout: 15_000 }
  ).toBeGreaterThan(0);
}

test.describe('CompleActe — ecranul 2 (Date)', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);

  test('randare: ecranul «Date» se deschide cu formularul populat', async ({ page }) => {
    await ecranDate(page);
    await expect(page.locator('#p2')).toHaveClass(/activ/);
    await expect(page.locator('#form-container [data-pdf]').first()).toBeVisible();
  });

  test('randare: toate câmpurile obligatorii din valideaza() există în formular', async ({ page }) => {
    await ecranDate(page);
    for (const cheie of CHEI_OBLIGATORII) {
      await expect(
        page.locator(`#s2 [data-pdf="${cheie}"]`),
        `câmp obligatoriu lipsă din formular: ${cheie}`
      ).toHaveCount(1);
    }
  });

  test('scan: butoanele .btn-scan sunt randate pentru câmpurile scanabile', async ({ page }) => {
    await ecranDate(page);
    await expect(page.locator('#form-container .btn-scan').first()).toBeVisible();
  });

  test('unitar: validCNP acceptă CNP valid și respinge CNP-uri invalide', async ({ page }) => {
    await page.goto(appUrl + '/');
    const cnp = cnpValid('193062512345'); // 12 cifre de bază + cifra de control calculată
    const rez = await page.evaluate((cnpGenerat) => {
      const f = (window as unknown as { validCNP: (c: string) => boolean }).validCNP;
      return {
        valid: f(cnpGenerat),
        cifraControlGresita: f(cnpGenerat.slice(0, 12) + (cnpGenerat[12] === '0' ? '1' : '0')),
        scurt: f('123'),
      };
    }, cnp);
    expect(rez.valid).toBe(true);
    expect(rez.cifraControlGresita).toBe(false);
    expect(rez.scurt).toBe(false);
  });

  /**
   * DEFECT-001 — docs/defecte/DEFECT-001-lipsa-buton-verificare.md
   * Nicio bucată de cod din aplicație nu apelează laVerificare(), deci
   * utilizatorul nu poate ajunge la ecranul «Verificare» (unde are loc
   * validarea, deblocarea #btnGenereaza și generarea PDF-ului).
   *
   * test.fail = eșec AȘTEPTAT cât timp defectul e deschis.
   * Când dev-ul repară app-ul, testul va trece și Playwright va semnala
   * „expected to fail but passed” — atunci ștergem adnotarea test.fail
   * și închidem DEFECT-001. Alarmă automată inversă.
   */
  test.fail('DEFECT-001: formularul are buton spre ecranul «Verificare»', async ({ page }) => {
    await ecranDate(page);
    const btnContinua = page.locator('#s2 button:not(.btn-scan)');
    await expect(
      btnContinua,
      'lipsește butonul care apelează laVerificare() — vezi DEFECT-001'
    ).toHaveCount(1);
    await btnContinua.first().click();
    await expect(page.locator('#s3')).toBeVisible();
    await expect(page.locator('#p3')).toHaveClass(/activ/);
  });
});
