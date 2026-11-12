import { test, expect, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită UI pentru ecranul 3 «Verificare» din CompleActe.
 *
 * Context DEFECT-001: nicio bucată de cod din aplicație NU apelează laVerificare(),
 * deci utilizatorul real nu poate ajunge la acest ecran. Funcția INSĂ există în
 * index.html, deci testele de mai jos intră chirurgical prin page.evaluate(() =>
 * laVerificare()) — exact ca un utilizator care ar fi avut butonul.
 *
 * Astfel suita rulează AZI (fără fix-ul dev-ului) și oferă acoperire completă
 * pentru ecranul 3 din prima secundă după reparare. Navigarea reală prin UI
 * rămâne acoperită de testul DEFECT-001 din date.spec.ts (test.fail).
 *
 * Selectorii sunt cei reali, citiți din index.html (2026-11-12):
 *  - #s3 conține oglinzi readonly ale câmpurilor din #s2 (data-pdf identic);
 *  - wrapperul fix-s3-copiere copiază valorile s2 → s3 înainte de arata(3);
 *  - valideaza() blochează/deblochează #btnGenereaza și comută #avertisment
 *    (element confirmat la linia 81 din index.html);
 *  - arata(3) adaugă clasa «ascuns» pe #s2 — orice fill() pe câmpurile din #s2
 *    cere întoarcerea chirurgicală cu arata(2) (app-ul nu are buton «înapoi»).
 *
 * Serverul static e identic cu cel din date.spec.ts (port aleator, nimic permanent).
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
  if (server) await Promise.race([
    new Promise(r => (server as http.Server).close(() => r(null))),
    new Promise(r => setTimeout(r, 2000)),
  ]);
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

/** Valori realiste pentru fiecare cheie obligatorie (CNP-urile sunt generate, deci valide). */
const VALORI_TEST: Record<(typeof CHEI_OBLIGATORII)[number], string> = {
  v_nume: 'Popescu Ion', v_cnp: cnpValid('193062512345'), v_telefon: '0722111222',
  c_nume: 'Ionescu Maria', c_cnp: cnpValid('295011944455'), c_telefon: '0733222333',
  m_marca: 'Dacia', m_nr_inmatriculare: 'B 12 ABC', m_vin: 'UU1HSDCAP12345678',
  pret_cifre: '15000', pret_litere: 'cincisprezece mii', contract_loc: 'București',
  contract_data: '12.11.2026',
};

/** Navighează ca utilizatorul real până la ecranul «Date». */
async function ecranDate(page: Page) {
  await page.goto(appUrl + '/');
  await page.locator('#acord').check();
  await page.locator('button:has-text("Continuă")').click();
  await expect(page.locator('#s2')).toBeVisible();
  await expect.poll(async () =>
    page.locator('#form-container [data-pdf]').count(), { timeout: 15_000 }
  ).toBeGreaterThan(0);
}

/** Apelează o funcție globală fără argumente din index.html, cu mesaj clar dacă nu există. */
async function apeleazaGlobal(page: Page, nume: string) {
  await page.evaluate((n) => {
    const f = (window as unknown as Record<string, unknown>)[n];
    if (typeof f !== 'function') throw new Error(`${n} nu există pe window`);
    (f as () => void)();
  }, nume);
}

/**
 * Completează (opțional) câmpurile obligatorii din #s2, apoi intră pe ecranul 3
 * chirurgical: apelează laVerificare() — exact ce ar face butonul lipsă (DEFECT-001).
 * Wrapperul fix-s3-copiere interceptează apelul și copiază s2 → s3 înainte de arata(3).
 */
async function intrareVerificare(page: Page, completa = true) {
  await ecranDate(page);
  if (completa) {
    for (const cheie of CHEI_OBLIGATORII) {
      await page.locator(`#s2 [data-pdf="${cheie}"]`).fill(VALORI_TEST[cheie]);
    }
  }
  await apeleazaGlobal(page, 'laVerificare');
  await expect(page.locator('#s3')).toBeVisible();
}

test.describe('CompleActe — ecranul 3 (Verificare)', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);

  test('randare: laVerificare() afișează ecranul 3 și pasul 3 devine activ', async ({ page }) => {
    await intrareVerificare(page);
    await expect(page.locator('#s3')).toBeVisible();
    await expect(page.locator('#p3')).toHaveClass(/activ/);
    await expect(page.locator('#p2')).not.toHaveClass(/activ/);
  });

  test('copiere fix-s3-copiere: oglinzile readonly din #s3 reflectă valorile din #s2', async ({ page }) => {
    await intrareVerificare(page);
    for (const cheie of CHEI_OBLIGATORII) {
      const oglinda = page.locator(`#s3 [data-pdf="${cheie}"]`);
      if (await oglinda.count() === 0) continue; // unele chei pot rămâne doar în #s2
      await expect(
        oglinda.first(),
        `oglinda din s3 nu are valoarea copiată pentru ${cheie}`
      ).toHaveValue(VALORI_TEST[cheie]);
    }
  });

  test('gating: #btnGenereaza rămâne blocat și #avertisment vizibil când lipsesc date', async ({ page }) => {
    await intrareVerificare(page, false);
    await expect(page.locator('#btnGenereaza')).toBeVisible();
    await expect(page.locator('#btnGenereaza')).toBeDisabled();
    await expect(page.locator('#avertisment')).toBeVisible();
  });

  test('gating: #btnGenereaza se deblochează când toate datele obligatorii sunt valide', async ({ page }) => {
    await intrareVerificare(page, true);
    await expect(page.locator('#btnGenereaza')).toBeVisible();
    await expect(page.locator('#avertisment')).toBeHidden();
    await expect(page.locator('#btnGenereaza'), 'date valide + CNP valide ⇒ butonul trebuie deblocat').toBeEnabled();
  });

  test('randare: câmpurile .gresit din #s2 sunt curățate după validare cu succes', async ({ page }) => {
    await intrareVerificare(page, false);
    // date incomplete ⇒ valideaza() (apelat de wrapperul laVerificare) marchează .gresit
    await expect(page.locator('#s2 .gresit').first()).toBeAttached();

    // arata(3) a ascuns #s2 (clasa «ascuns»); app-ul nu are buton «înapoi»
    // (DEFECT-001), deci ne întoarcem chirurgical pe ecranul 2 ca să completăm.
    await page.evaluate(() => {
      const f = (window as unknown as { arata?: (n: number) => void }).arata;
      if (typeof f !== 'function') throw new Error('arata nu există pe window');
      f(2);
    });

    for (const cheie of CHEI_OBLIGATORII) {
      await page.locator(`#s2 [data-pdf="${cheie}"]`).fill(VALORI_TEST[cheie]);
    }
    await apeleazaGlobal(page, 'valideaza');

    await expect(page.locator('#s2 .gresit')).toHaveCount(0);
    await expect(page.locator('#avertisment')).toBeHidden();
  });
});
