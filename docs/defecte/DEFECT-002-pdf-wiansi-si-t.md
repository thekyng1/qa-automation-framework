# DEFECT-002 — ș/ț din datele completate omoară generarea PDF (WinAnsi)

| Câmp | Valoare |
|---|---|
| ID | DEFECT-002 |
| Severitate | **Critic (blocaj funcțional)** |
| Descoperit | 2026-11-12, de suita de teste `tests/compleacte/contract.spec.ts` (PR #15), la testarea descărcării PDF-ului |
| Componentă | CompleActe — ecranul 3 «Verificare» → `genereazaContract()` → `completeazaFormular()` (pdf-lib) |
| Mediu | `/opt/qa/compleacte-www` (build `2026-10-26-mapping-2`), Chromium headless via Playwright |
| Stare | DESCHIS |

## Pași de reproducere

1. Intră pe ecranul 3 «Verificare» cu date valide (`laVerificare()`; pe build-ul actual doar chirurgical — vezi DEFECT-001).
2. Completează orice câmp cu text care conține **ș** (U+0219) sau **ț** (U+021B) — ex. `contract_loc: "București"`.
3. Apasă `#btnGenereaza` (deblocat de `valideaza()`).

## Așteptat

Se generează contractul PDF cu textul complet, inclusiv diacriticele românești, și se declanșează descărcarea.

## Obținut

**Zero descărcare.** `completeazaFormular()` aruncă:

```text
WinAnsi cannot encode "ș" (0x0219)
```

Eroarea e prinsă de `catch`-ul din `genereazaContract()` și transformată în `alert('Eroare la generare: …')`. Utilizatorul primește alerta de eroare și nu primește contractul.

## Dovezi

- Mesajul exact, capturat de suita de teste la 2026-11-12 (rulare pe server, Chromium):

```text
dialog alert: Eroare la generare: WinAnsi cannot encode "ș" (0x0219)
```

- Capturat prin instrumentarea testului: handler pe `page.on('dialog')` + colectare `pageerror`/`console.error`, incluse în mesajul de failure la timeout-ul `waitForEvent('download')`. Detaliile rulării: 19/19 teste passed pe `main` la `5c49c83`.

## Impact

Orice utilizator real din România care completează **„București", „Reșița", „Ploiești"** sau orice nume/marcă/loc cu ș/ț **nu poate genera contractul** — primește alerta de eroare. Datele cu ă, â, î, â funcționează (sunt în WinAnsi); doar ș și ț (U+0219/U+021B, „cu sedilă" din Unicode modern) lipsesc.

## Cauză

`pdf-lib` cu font standard (Helvetica etc.) encodează textul în **WinAnsi** (codarea implicită a fonturilor standard PDF). WinAnsi nu conține punctele de cod U+0219 (ș) și U+021B (ț). Notă: vechile ş/ţ „cu sedilă" (U+015F/U+0163) există în WinAnsi, dar nu sunt cele tastate astăzi pe tastaturile românești standard.

## Propunere de remediere (pentru dezvoltatorul aplicației)

1. **Recomandat:** embeduire font Unicode — `@pdf-lib/fontkit` + `embedFont` cu un TTF cu suport complet diacritice (ex. DejaVu Sans, Liberation Sans):
   ```js
   import fontkit from '@pdf-lib/fontkit';
   import fontBytes from './fonts/DejaVuSans.ttf';
   pdfDoc.registerFontkit(fontkit);
   const font = await pdfDoc.embedFont(fontBytes, { subset: true });
   ```
2. **Fallback minimal:** transliterare ș→s, ț→t (sau ş/ţ cu sedilă) înainte de desenarea textului — contractul se generează, dar fără diacriticele corecte.

## Acoperire în teste

`tests/compleacte/contract.spec.ts` — test marcat `test.fail`: „DEFECT-002: ș/ț în date → alertă WinAnsi, fără descărcare". Testul completează `contract_loc: "București"`, apasă `#btnGenereaza` și așteaptă alerta cu mesajul WinAnsi exact; cât timp defectul e deschis, eșecul e comportamentul așteptat. Când dev-ul repară fontul, testul va începe să treacă și Playwright va semnala „expected to fail but passed" — moment în care se șterge adnotarea `test.fail` și DEFECT-002 se închide. La fel ca DEFECT-001, defectul devine **alarmă automată inversă**: imposibil de reparat fără să observăm.

## Lecție de testare (notată pentru viitor)

Eroarea a fost **invizibilă la prima rulare**: în Playwright, o `alert()` fără handler e respinsă automat și în tăcere, iar timeout-ul descărcării spunea doar „Timeout 30000ms exceeded". Abia după instrumentarea testului (colectarea dialogurilor în mesajul de failure), mesajul real WinAnsi a apărut. Regulă: **la timeout-uri misterioase, instrumentează testul să-ți spună ce s-a întâmplat în pagină — nu ghici.**
