import { test, expect, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită pentru genereazaContract() — ecranul 3 «Verificare», pasul final CompleActe.
 *
 * Context DEFECT-001: intrarea pe ecranul 3 rămâne chirurgicală
 * (laVerificare() prin page.evaluate), identic cu verificare.spec.ts.
 *
 * Fapte din index.html (citite, nu presupuse — 2026-11-12, liniile 138–162):
 *  - genereazaContract() este async, cu try/catch; orice eroare devine
 *    alert('Eroare la generare: '+e.message), iar lipsa formularului devine
 *    alert('Nu există formular încărcat.');
 *  - numele fișierului: (def.id||'formular')+'-'+ISO AAAA-LL-ZZ+'.pdf';
 *  - în browser (fără Capacitor) merge pe fallback: Blob + URL.createObjectURL
 *    + a.download + a.click(), deci Playwright prinde cu waitForEvent('download').
 *
 * DIAGNOSTIC: dacă descărcarea nu apare, cel mai probabil motivul e o alertă
 * „Eroare la generare: ..." respinsă automat (și mut) de Playwright. Testele
 * pozitive colectează dialogurile + erorile de consolă și le includ în
 * mesajul de failure — feedback real, nu ghicire.
 *
 * www/ NU e în repo (cheie API hardcodată); override: COMPLEACTE_WWW=/cale.
 * Fără folder (ex. CI) → SKIP, nu FAIL.
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

/** Chei obligatorii conform valideaza() din index.html — identice cu verificare.spec.ts. */
const CHEI_OBLIGATORII = [
  'v_nume', 'v_cnp', 'v_telefon',
  'c_nume', 'c_cnp', 'c_telefon',
  'm_marca', 'm_nr_inmatriculare', 'm_vin',
  'pret_cifre', 'pret_litere', 'contract_loc', 'contract_data',
] as const;

/** Aceleași greutăți ca în validCNP() din index.html. */
const GREUTATI_CNP = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

/** Generează un CNP valid cu algoritmul aplicației (cifră de control calculată). */
function cnpValid(baza12: string): string {
  if (!/^\d{12}$/.test(baza12)) throw new Error('baza12 trebuie să aibă exact 12 cifre');
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(baza12[i]) * GREUTATI_CNP[i];
  const cd = s % 11;
  return baza12 + String(cd === 10 ? 1 : cd);
}

/** Valori realiste; CNP-urile sunt generate, deci trec validCNP(). */
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

/** Apelează o funcție globală fără argumente, cu mesaj clar dacă nu există. */
async function apeleazaGlobal(page: Page, nume: string) {
  await page.evaluate((n) => {
    const f = (window as unknown as Record<string, unknown>)[n];
    if (typeof f !== 'function') throw new Error(`${n} nu există pe window`);
    (f as () => void)();
  }, nume);
}

/**
 * Colectează dialogurile, erorile de paginăă și erorile de consolă, ca la
 * timeout-ul descărcării mesajul de failure să conțină motivul REAL
 * (ex. alerta „Eroare la generare: ...", respinsă altfel automat și mut).
 */
function colecteazaSemnale(page: Page): string[] {
  const semnale: string[] = [];
  page.on('dialog', async (d) => {
    semnale.push(`dialog ${d.type()}: ${d.message()}`);
    await d.accept();
  });
  page.on('pageerror', (e) => semnale.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') semnale.push(`console.error: ${m.text()}`);
  });
  return semnale;
}

/**
 * Flux complet până pe ecranul 3 cu date valide:
 * acord → Continuă → completează tot → laVerificare() (intrare chirurgicală,
 * DEFECT-001) → #btnGenereaza deblocat de valideaza().
 */
async function intrareVerificareCuDate(page: Page) {
  await ecranDate(page);
  for (const cheie of CHEI_OBLIGATORII) {
    await page.locator(`#s2 [data-pdf="${cheie}"]`).fill(VALORI_TEST[cheie]);
  }
  await apeleazaGlobal(page, 'laVerificare');
  await expect(page.locator('#s3')).toBeVisible();
  await expect(page.locator('#btnGenereaza')).toBeEnabled();
}

test.describe('CompleActe — genereazaContract() (PDF)', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);

  test('descărcare: click pe #btnGenereaza produce un fișier cu numele corect', async ({ page }) => {
    const semnale = colecteazaSemnale(page);
    await intrareVerificareCuDate(page);

    const defId = await page.evaluate(() =>
      String((window as unknown as { DEFINITIE_FORMULAR?: { id?: string } }).DEFINITIE_FORMULAR?.id || 'formular')
    );
    const azi = new Date().toISOString().slice(0, 10);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.locator('#btnGenereaza').click(),
    ]).catch(() => {
      throw new Error(
        `descărcarea nu a apărut în 30s. Semnale din pagină: ${semnale.length ? semnale.join(' || ') : 'niciunul'}`
      );
    });

    expect(download.suggestedFilename(), 'numele provine din a.download, construit din def.id + data ISO').toMatch(
      new RegExp(`^${defId}-${azi}\\.pdf$`)
    );
  });

  test('conținut: fișierul descărcat este un PDF real (magic bytes %PDF, nevid)', async ({ page }) => {
    const semnale = colecteazaSemnale(page);
    await intrareVerificareCuDate(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.locator('#btnGenereaza').click(),
    ]).catch(() => {
      throw new Error(
        `descărcarea nu a apărut în 30s. Semnale din pagină: ${semnale.length ? semnale.join(' || ') : 'niciunul'}`
      );
    });

    const caleTemp = path.join(os.tmpdir(), `compleacte-${Date.now()}.pdf`);
    await download.saveAs(caleTemp);
    const bytes = fs.readFileSync(caleTemp);

    expect(bytes.length, 'contractul generat nu poate fi gol').toBeGreaterThan(1000);
    expect(bytes.subarray(0, 5).toString(), 'un PDF valid începe cu %PDF-').toMatch(/^%PDF-/);
    fs.rmSync(caleTemp, { force: true });
  });

  test('negativ: fără formular încărcat, genereazaContract() avertizează, nu crapă', async ({ page }) => {
    await intrareVerificareCuDate(page);

    // Guard-ul din index.html: if(!def){ alert('Nu există formular încărcat.'); return; }
    await page.evaluate(() => {
      (window as unknown as { DEFINITIE_FORMULAR: unknown }).DEFINITIE_FORMULAR = null;
    });

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Nu există formular încărcat.');
      await dialog.accept();
    });
    await apeleazaGlobal(page, 'genereazaContract');
  });

  test('negativ: eroare din completeazaFormular() devine alertă, nu crash mut', async ({ page }) => {
    await intrareVerificareCuDate(page);

    const suprascris = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      if (typeof w.completeazaFormular !== 'function') return false;
      w.completeazaFormular = async () => { throw new Error('test: generator deteriorat'); };
      return true;
    });
    test.skip(!suprascris, 'completeazaFormular nu este global în această versiune — guard de compatibilitate');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Eroare la generare:');
      expect(dialog.message()).toContain('test: generator deteriorat');
      await dialog.accept();
    });
    await apeleazaGlobal(page, 'genereazaContract');
  });
});
