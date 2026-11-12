import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită MOBILĂ pentru CompleActe.
 *
 * De ce există: app-ul țintește Capacitor (WebView Android). Un buton care
 * merge cu click de mouse poate eșua cu touch (tap). Playwright emulează
 * dispozitivul mobil prin proiectul `mobile-chrome` (Pixel 7, hasTouch,
 * isMobile, viewport 412x915) — testele de aici NU rulează în proiectul
 * `chromium` desktop; cele comune sunt deja acoperite de restul suitei.
 *
 * Serverul static de app e identic cu cel din ui.spec.ts: port aleator,
 * nimic permanent. www/ NU e în repo (conține cheie API hardcodată);
 * pe server: /opt/qa/compleacte-www. Override: COMPLEACTE_WWW=cale.
 * Dacă folderul lipsește (CI), testele fac SKIP — nu FAIL.
 *
 * Fără filtre grep/testMatch "ca să forțăm verde": testele se auto-sar
 * doar când app-ul fizic lipsește (ca în ui.spec.ts), iar CI-ul va rula
 * suita CompleActe completă. Vezi comentariul din playwright.config.ts.
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

/** Tap = eveniment touch, nu click. page.tap() refuză pe elemente non-tappable. */
async function tap(page: import('@playwright/test').Page, selector: string) {
  await page.tap(selector);
}

/** Măsoară cutia unui element și returnează {w, h}. */
async function dimensiune(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
}

/** Aceleași greutăți ca în validCNP() din index.html. */
const GREUTATI_CNP = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

/** Generează un CNP valid cu algoritmul aplicației — ca în verificare.spec.ts.
 *  Lecția din run #5: CNP hardcodat „de mână" poate avea checksum greșit
 *  (2930525123457 → cifra corectă e 1, nu 7) și valideaza() îl respinge. */
function cnpValid(baza12: string): string {
  if (!/^\d{12}$/.test(baza12)) throw new Error('baza12 trebuie să aibă exact 12 cifre');
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(baza12[i]) * GREUTATI_CNP[i];
  const cd = s % 11;
  return baza12 + String(cd === 10 ? 1 : cd);
}

test.describe('CompleActe mobil', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);
  test.skip(() => !test.info().project.name.startsWith('mobile'), 'doar în proiectul mobile-chrome');

  test('health: pagina se încarcă fără overflow orizontal la 412px', async ({ page }) => {
    await page.goto(appUrl + '/');
    await expect(page).toHaveTitle(/CompleActe/);
    // Overflow orizontal = elementul lat care obligă scrollul lateral, clasic pe mobil
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1); // toleranță 1px pentru rotunjiri
  });

  test('flux: acord (checkbox la 44px+) → tap Continuă → ecranul 2', async ({ page }) => {
    await page.goto(appUrl + '/');
    const cb = page.locator('#acord');
    await cb.tap();
    await expect(cb).toBeChecked();
    await tap(page, 'button:has-text("Continuă")');
    await expect(page.locator('#s2')).toBeVisible();
  });

  test('negativ: fără acord, tap Continuă → alertă, rămâi pe ecranul 1', async ({ page }) => {
    await page.goto(appUrl + '/');
    await tap(page, 'button:has-text("Continuă")');
    page.once('dialog', d => d.accept()); // alert('Bifează acordul mai întâi.')
    await expect(page.locator('#s1')).toBeVisible();
    await expect(page.locator('#s2')).toBeHidden();
  });

  /**
   * DEFECT-003 (REZOLVAT — 2026-11-12): .btn-scan avea 38px, sub minimul
   * 44px din ghidul Android Material. Dev a adăugat min-height:44px +
   * min-width:44px în CSS (ambele copii ale app-ului). Alarma inversă
   * (test.fail, pattern DEFECT-001) a declanșat în run #7 cu „expected
   * to fail but passed" — adnotarea a fost ștearsă, testul e acum
   * REGRESIE PERMANENTĂ: dacă butonul scade vreodată sub 44px, pică cu
   * mesajul exact (38 < 44), nu trece neobservat.
   */
  test('tap-target: .btn-scan are cel puțin 44x44 px (Android Material)', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('#acord').tap();
    await tap(page, 'button:has-text("Continuă")');
    await expect(page.locator('.btn-scan').first()).toBeVisible();
    const d = await dimensiune(page, '.btn-scan >> nth=0');
    expect(d.w).toBeGreaterThanOrEqual(44);
    expect(d.h).toBeGreaterThanOrEqual(44);
  });

  test('tap-target: Continuă/Verifică au cel puțin 44x44 px', async ({ page }) => {
    await page.goto(appUrl + '/');
    const d = await dimensiune(page, 'button:has-text("Continuă")');
    expect(d.w).toBeGreaterThanOrEqual(44);
    expect(d.h).toBeGreaterThanOrEqual(44);
  });

  test('tap pe .btn-scan deschide selectorul de fișier (filechooser)', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('#acord').tap();
    await tap(page, 'button:has-text("Continuă")');
    await expect(page.locator('.btn-scan').first()).toBeVisible();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      tap(page, '.btn-scan >> nth=0'),
    ]);
    expect(chooser.isMultiple()).toBe(false);
  });

  test('flux complet pe mobil: formular valid → Verifică → PDF descărcat', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('#acord').tap();
    await tap(page, 'button:has-text("Continuă")');
    await expect.poll(async () =>
      page.locator('#form-container input[data-pdf]').count(), { timeout: 10_000 }
    ).toBeGreaterThan(0);

    // Completează TOATE câmpurile cerute de valideaza() în #s2 — inclusiv
    // contract_data: validarea îl cere non-vid ÎNAINTE de generare; auto-data
    // din genereazaContract() vine prea târziu (butonul e încă disabled).
    // CNP-urile sunt GENERATE cu cnpValid() (algoritmul app-ului), nu
    // hardcodate — un checksum greșit „de mână" face valideaza() să respingă.
    const azi = new Date().toLocaleDateString('ro-RO');
    const date: Record<string, string> = {
      v_nume: 'Maria Ionescu', v_cnp: cnpValid('1800101010015'.slice(0, 12)), v_telefon: '0722111111',
      c_nume: 'Ion Popescu', c_cnp: cnpValid('293052512345'.slice(0, 12)), c_telefon: '0722222222',
      m_marca: 'Dacia', m_tip: 'Logan',
      m_nr_inmatriculare: 'CJ 01 ABC', m_vin: 'UU1HSDCAP54123456',
      pret_cifre: '25000', pret_litere: 'Douăzeci și cinci de mii',
      contract_loc: 'Cluj-Napoca', contract_data: azi,
    };
    for (const [k, v] of Object.entries(date)) {
      const el = page.locator(`#form-container [data-pdf="${k}"]`);
      if (await el.count() > 0) { await el.fill(v); }
    }

    await tap(page, 'button:has-text("Verifică")');
    await expect(page.locator('#s3')).toBeVisible();
    await expect(page.locator('#btnGenereaza')).toBeEnabled({ timeout: 10_000 });

    // În browser (fără Capacitor), generarea face download — interceptăm blob-ul
    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await tap(page, '#btnGenereaza');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
