import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Suită scanare OCR pentru CompleActe.
 *
 * Ce testează (și CE NU testează):
 * - NU apelăm Google Vision real (cheie, cost, rețea) — endpointul
 *   `https://vision.googleapis.com/v1/images:annotate` e interceptat cu page.route().
 * - Parsarea e testată pe funcțiile PURE expuse public: OCR.parseazaCI /
 *   parseazaTalon / referinteCI și MRZ.dinText / valideazaCNP (zero rețea, zero DOM).
 * - Lanțul complet OCR → parsare → formular e testat cu aplicatorul injectabil
 *   (UIB.populeazaFormular) pe câmpuri sintetice cu prefix unic (tst_/e2e_),
 *   ca să nu coliziuneze cu câmpurile reale ale formularului.
 * - Textele de test sunt sintetice, cu aceeași structură pe care o întoarce
 *   DOCUMENT_TEXT_DETECTION din Vision (fullTextAnnotation.text).
 *
 * www/ NU e în repo: pe server /opt/qa/compleacte-www (vezi ui.spec.ts).
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

/* ---------- Texte OCR sintetice (structura răspunsului Vision) ---------- */

/* CI fără bandă MRZ: etichetele de referință din aplicația veche (Kotlin). */
const TEXT_CI = [
  'ROMANIA',
  'CARTE DE IDENTITATE',
  'Nume/Nom/Last name',
  'IONESCU',
  'Prenume/Prenom/First name',
  'MARIA',
  'CNP 1800101010015',
  'SERIA AB NR 123456',
  'Domiciliu/Adresse/Address',
  'Str. Libertatii nr 10',
  'Mun. Bucuresti, Jud. Bucuresti',
].join('\n');

/* Talon: VIN 17 (fără I/O/Q), placă, an fabricație, marcă + tip. */
const TEXT_TALON = [
  'CERTIFICAT DE INMATRICULARE',
  'D.1 VOLKSWAGEN',
  'D.3 GOLF',
  'B 123 ABC',
  'AN FABRICATIE 2019',
  'MARCA VOLKSWAGEN GOLF',
  'E WVWZZZ1KZAW123456',
].join('\n');

test.describe('CompleActe · Scanare OCR', () => {
  test.skip(APP_MISSING, `app-ul nu există la ${APP_DIR} — rulare doar pe server`);

  /* ===================== A. Parsare pură (fără rețea, fără DOM) ===================== */

  test('pură: OCR.parseazaTalon extrage VIN, placă, an, marcă și tip', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate((t) => (window as any).OCR.parseazaTalon(t), TEXT_TALON);
    expect(r.ok).toBe(true);
    expect(r.umplute).toBe(5);
    expect(r.date).toEqual({
      vin: 'WVWZZZ1KZAW123456',
      nr_inmatriculare: 'B 123 ABC',
      an_fabricatie: '2019',
      marca: 'VOLKSWAGEN',
      tip: 'GOLF',
    });
  });

  test('pură: OCR.parseazaTalon pe text fără nimic recognizabil → DEPANARE, ok:false', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate(
      (t) => (window as any).OCR.parseazaTalon(t),
      'HELLO WORLD\nFOO BAR 42\nTEST'
    );
    expect(r.ok).toBe(false);
    expect(r.umplute).toBe(0);
    expect(r.mesaj).toContain('DEPANARE TALON');
  });

  test('pură: OCR.referinteCI extrage cele 6 câmpuri din textul CI (fără MRZ)', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate((t) => (window as any).OCR.referinteCI(t), TEXT_CI);
    expect(r.nume).toBe('Maria Ionescu');          // prenume + nume, Title Case
    expect(r.cnp).toBe('1800101010015');
    expect(r.act_serie).toBe('AB');
    expect(r.act_nr).toBe('123456');
    expect(r.judet).toBe('Bucuresti');
    expect(r.localitate).toBe('Bucuresti');
  });

  test('pură: OCR.parseazaCI fără bandă MRZ cade pe referințe și dă ok', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate((t) => (window as any).OCR.parseazaCI(t, 'CI vanzator'), TEXT_CI);
    expect(r.date).toBeNull();                     // fără MRZ → calea de fallback
    expect(r.rezultat.ok).toBe(true);
    expect(r.rezultat.umplute).toBe(6);
    expect(r.rezultat.campuri).toContainEqual(['cnp', '1800101010015']);
    expect(r.rezultat.mesaj).toContain('OK (referinte)');
  });

  test('pură: MRZ.valideazaCNP — cifră de control corectă vs greșită', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate(() => ({
      valid: (window as any).MRZ.valideazaCNP('1800101010015'),   // suma%11 = 5 = cifra de control
      controlGresit: (window as any).MRZ.valideazaCNP('1800101010016'),
      preaScurt: (window as any).MRZ.valideazaCNP('123'),
    }));
    expect(r.valid).toBe(true);
    expect(r.controlGresit).toBe(false);
    expect(r.preaScurt).toBe(false);
  });

  test('pură: MRZ.dinText parsează banda MRZ sintetică (nume, CNP valid, serie, nr act)', async ({ page }) => {
    await page.goto(appUrl + '/');
    const r = await page.evaluate(() => {
      /* Format TD1 linia 1: IDRO + cod țară (XX = necunoscut/test) + serie act (AB)
         + număr act (1234567). Regexul real: /^I?DRO[A-Z]{0,3}([A-Z]{2,3})<?([A-Z0-9]{4,8})/
         → țara XX se consumă în [A-Z]{0,3}, seria capturată e AB, nr act 1234567. */
      const TEXT_MRZ = [
        'IDROXXAB1234567<<<<<<<<<<<<<',
        '1800101010015<012345678901234<',
        'IONESCU<<MARIA<<<<<<<<<<<<<<<',
      ].join('\n');
      return (window as any).MRZ.dinText(TEXT_MRZ);
    });
    expect(r.ok).toBe(true);
    expect(r.date.nume).toBe('IONESCU');
    expect(r.date.prenume).toBe('MARIA');
    expect(r.date.cnp).toBe('1800101010015');
    expect(r.date.serie).toBe('AB');
    expect(r.date.nrAct).toBe('1234567');
  });

  /* ===================== B. UIB — scrierea în formular ===================== */

  test('UIB.populeazaFormular: prefix, sare readonly, izolează #s3, diagnostic corect', async ({ page }) => {
    await page.goto(appUrl + '/');
    /* Câmpuri sintetice cu prefix unic (tst_) — nu colizionează cu formularul real. */
    await page.evaluate(() => {
      const s2 = document.getElementById('s2')!;
      const s3 = document.getElementById('s3')!;
      const mk = (id: string, attr: string, ro: boolean) => {
        const i = document.createElement('input');
        i.id = id; i.setAttribute('data-pdf', attr); i.readOnly = ro;
        return i;
      };
      s2.append(
        mk('t-ro', 'tst_serie', true),           // primul candidat, dar readonly
        mk('t-ok', 'tst_serie_buletin', false),  // aliasul din grupul „serie”
        mk('t-cnp', 'tst_cnp', false)
      );
      s3.append(mk('t-s3', 'tst_cnp', false));   // copie readonly-eco în ecranul 3
    });
    const n = await page.evaluate(() =>
      (window as any).UIB.populeazaFormular(
        [['serie', 'AB'], ['cnp', '1800101010015'], ['judet', 'Bucuresti']],
        'tst_'
      )
    );
    expect(n).toBe(2); // serie + cnp scrise; judet nu are câmp → lipsă
    const st = await page.evaluate(() => {
      const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
      return {
        ro: v('t-ro'), ok: v('t-ok'), cnp: v('t-cnp'), s3: v('t-s3'),
        diag: (window as any).UIB.diagnostic(),
      };
    });
    expect(st.ok).toBe('AB');                    // aliasul serie → serie_buletin
    expect(st.ro).toBe('');                      // readonly sărit, nu scris
    expect(st.cnp).toBe('1800101010015');
    expect(st.s3).toBe('');                      // ecranul 3 NU e atins la scanare
    expect(st.diag.scrise.length).toBe(2);
    expect(st.diag.scrise[0].camp).toBe('tst_serie_buletin');
    expect(st.diag.lipsa).toEqual(['judet']);
  });

  /* ===================== C. End-to-end cu Vision mock-uit ===================== */

  test('e2e (Vision mock): scanCI completează formularul prin UIB.populeazaFormular', async ({ page }) => {
    await page.goto(appUrl + '/');
    let apeluriVision = 0;
    await page.route('**/vision.googleapis.com/**', async (route) => {
      apeluriVision++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ responses: [{ fullTextAnnotation: { text: TEXT_CI } }] }),
      });
    });
    await page.evaluate(() => {
      (window as any).OCR.seteazaCheie('CHEIE_DE_TEST'); // cheie falsă — Vision e oricum mock-uit
      const s2 = document.getElementById('s2')!;
      ['nume', 'cnp', 'act_serie', 'act_nr', 'judet', 'localitate'].forEach((k) => {
        const i = document.createElement('input');
        i.id = 'e2e-' + k;
        i.setAttribute('data-pdf', 'e2e_' + k);
        s2.appendChild(i);
      });
    });
    /* Imagine generată la runtime prin canvas — fără fișier extern. */
    const img = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#000000'; ctx.font = '16px sans-serif';
      ctx.fillText('CI TEST', 4, 32);
      return c.toDataURL('image/jpeg', 0.9);
    });
    const rez = await page.evaluate(async (dataImg) => {
      const { OCR, UIB } = window as any;
      return await OCR.scanCI(dataImg, 'e2e_', 'CI vanzator', null, UIB.populeazaFormular);
    }, img);
    expect(apeluriVision).toBe(1);               // exact un apel către Vision (interceptat)
    expect(rez.umplute).toBe(6);                 // toate cele 6 câmpuri SCRISE, nu doar extrase
    expect(rez.mesaj).toContain('OK');
    const valori = await page.evaluate(() => Object.fromEntries(
      ['nume', 'cnp', 'act_serie', 'act_nr', 'judet', 'localitate'].map(
        (k) => [k, (document.getElementById('e2e-' + k) as HTMLInputElement).value]
      )
    ));
    expect(valori.nume).toBe('Maria Ionescu');
    expect(valori.cnp).toBe('1800101010015');
    expect(valori.act_serie).toBe('AB');
    expect(valori.act_nr).toBe('123456');
    expect(valori.judet).toBe('Bucuresti');
    expect(valori.localitate).toBe('Bucuresti');
  });

  test('negativ: fără cheie Vision, scanCI respinge cu mesajul LIPSA CHEIE', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.evaluate(() => {
      (window as any).OCR.seteazaCheie('');      // neutralizează și CHEIA din modul
      (window as any).VISION_API_KEY = '';        // și cheia din index.html
      try { localStorage.removeItem('vision_api_key'); } catch (e) {}
    });
    const img = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      c.getContext('2d')!.fillRect(0, 0, 8, 8);
      return c.toDataURL('image/jpeg', 0.5);
    });
    await expect(page.evaluate(async (dataImg) => {
      const { OCR, UIB } = window as any;
      return await OCR.scanCI(dataImg, 'e2e_', 'CI vanzator', null, UIB.populeazaFormular);
    }, img)).rejects.toThrow(/LIPSA CHEIE/);
  });

  test('negativ: cheie respinsă de Google (HTTP 400) → mesaj cu INVALIDA, nu crash', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.route('**/vision.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' },
        }),
      });
    });
    await page.evaluate(() => (window as any).OCR.seteazaCheie('CHEIE_FALSA_PENTRU_TEST'));
    const img = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      c.getContext('2d')!.fillRect(0, 0, 8, 8);
      return c.toDataURL('image/jpeg', 0.5);
    });
    await expect(page.evaluate(async (dataImg) => {
      const { OCR, UIB } = window as any;
      return await OCR.scanCI(dataImg, 'e2e_', 'CI vanzator', null, UIB.populeazaFormular);
    }, img)).rejects.toThrow(/Cheia Google Vision este INVALIDA/);
  });

  /* ===================== D. Declanșare din buton ===================== */

  test('declanșare: click pe .btn-scan deschide selectorul de imagini (fallback desktop)', async ({ page }) => {
    await page.goto(appUrl + '/');
    await page.locator('#acord').check();
    await page.locator('button:has-text("Continuă")').click();
    const btn = page.locator('.btn-scan').first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    /* Ipoteză de verificat: SCUI.init() rulează la DOMContentLoaded, DAR butoanele
       de scanare sunt randate asincron de form-engine (fetch + render în #form-container).
       Dacă initul nu se re-apelează după încărcarea formularului, onclick nu e legat
       → filechooser nu apare → timeout → DEFECT (cronometrarea init).
       Rezultat la prima rulare: TRECE — cronometrarea e corectă, nu există DEFECT-003. */
    const alegere = page.waitForEvent('filechooser', { timeout: 5_000 });
    await btn.click();
    await alegere;
  });
});
