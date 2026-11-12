# DEFECT-001 — Lipsa butonului de trecere la ecranul „Verificare” (pasul 3)

| Câmp | Valoare |
|---|---|
| ID | DEFECT-001 |
| Severitate | **Critic (blocaj)** |
| Descoperit | 2026-11-11, în timpul explorării selectorilor pentru suita de teste ecranul „Date” |
| Componentă | CompleActe — flux: Acord → Date → Verificare |
| Mediu | `/opt/qa/compleacte-www` (build `2026-10-26-mapping-2`), verificat static prin grep |
| Stare | DESCHIS |

## Pași de reproducere

1. Deschide aplicația → ecranul „1 · Acord".
2. Alege formularul, bifează acordul, apasă „Continuă ➜".
3. Ecranul „2 · Date” se randează; completează formularul ITL 054.
4. Caută butonul de trecere la „3 · Verificare”.

## Așteptat

Un buton la finalul formularului (ex. „Continuă spre verificare”) care apelează `laVerificare()` / `arata(3)`.

## Obținut

**Nu există niciun buton care să apeleze `laVerificare()`.** Fluxul se oprește după ecranul „Date”. Ecranul 3 — unde are loc validarea (`valideaza()`), deblocarea `#btnGenereaza`, generarea și salvarea PDF-ului — este **inaccesibil**.

Funcția `laVerificare()` (`index.html`, linia 116) și wrapper-ul `fix-s3-copiere` (liniile ~163–174) sunt **cod mort**: definite, dar niciodată apelate din vreun element UI. Wrapper-ul a fost scris presupunând că funcția e apelată de undeva — nu este.

## Dovezi (grep pe server, 2026-11-11)

```text
grep -rn "laVerificare" www/lib/ www/forms/          → 0 rezultate
grep -rn "arata(3\|laVerificare" www/               → doar index.html (definiție + wrapper)
grep -rn "button\|Continu\|Verific" www/lib/form-engine.js
  → 33: '<button type="button" class="btn-scan" ...>'   (doar buton de scanare OCR)
www/lib/scan-ui.js:86-99                                (doar butoane de scanare OCR)
grep -rn "Continu\|Verific" www/forms/              → 0 rezultate
```

Singurele butoane generate dinamic de aplicație sunt cele de **scanare OCR** (`.btn-scan`) — nimic pentru navigarea spre ecranul 3.

## Impact

Fluxul de business al aplicației — scanare ID → completare șablon ITL 054 → **verificare → generare PDF → salvare locală → printare** — este tăiat la pasul esențial: verificarea și generarea. Aplicația nu-și poate livra valoarea finală (contractul generat).

## Cauze probabile

- migrarea pe motorul de formulare (`FormSelector`/`FormEngine`) a pierdut butonul de submit care probabil exista în variantele anterioare ale ecranului „Date”;
- sau butonul nu a fost niciodată conectat la `laVerificare()`.

## Propunere de remediere (pentru dezvoltatorul aplicației)

După randarea formularului în `lib/form-engine.js`, adăugat un buton care apelează funcția deja existentă:

```html
<button onclick="laVerificare()">Continuă spre verificare ➜</button>
```

Wrapper-ul `fix-s3-copiere` (copierea valorilor s2 → s3) va funcționa apoi automat — el doar redefină `laVerificare`.

## Acoperire în teste

`tests/compleacte/date.spec.ts` — test marcat `test.fail`: „DEFECT-001: formularul are buton spre ecranul «Verificare»". Cât timp defectul e deschis, testul eșuează (comportament așteptat, nu strică suita). Când remedierea apare, testul va trece și Playwright va semnala „expected to fail but passed" — moment în care se șterge adnotarea `test.fail` și DEFECT-001 se închide. Astfel defectul devine **alarmă automată inversă**: imposibil de reparat fără să observăm.

---
## STATUS: ✅ REZOLVAT — 2026-11-12
Fix: buton `<button onclick="laVerificare()">Verifică ➜</button>` adăugat în `#s2`,
după `#form-container` (index.html), în ambele copii ale app-ului.
Dovada: testul DEFECT-001 din date.spec.ts a trecut cu „expected to fail but passed"
imediat după fix; adnotarea test.fail a fost ștearsă — testul rămâne în suită ca regresie.
