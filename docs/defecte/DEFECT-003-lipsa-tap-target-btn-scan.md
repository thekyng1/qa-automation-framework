# DEFECT-003 — Lipsă tap-target pe `.btn-scan` (38px < 44px)

- **Status:** 🔴 DESCHIS (alarmă inversă `test.fail` activă în `tests/compleacte/mobil.spec.ts`)
- **Descoperit:** 2026-11-12, run #4 (QA Console), proiectul `mobile-chrome` (Pixel 7, 412px)
- **Testul care îl prinde:** `tap-target: .btn-scan are cel puțin 44x44 px (Android Material)`
- **Severitate:** medie — UX mobil; pe desktop invizibil
- **Unde:** `index.html` (CSS), ambele copii ale app-ului (repo privat `CompleActe` + `/opt/qa/compleacte-www`)

## Simptom

```
expect(d.h).toBeGreaterThanOrEqual(44)
Received: 38
```

## Cauză

CSS-ul butonului nu are `min-height`:

```css
.btn-scan{padding:10px 14px; font-size:15px; ...}  /* ≈ 38px computați */
```

Ghidul Android Material cere minim 44px (recomandat 48dp) pentru țintele de touch. Cu 38px, degetul ratează butonul de scanare — cel mai folosit buton din app pe mobil. Pe desktop defectul e invizibil pentru că nu există constrângerea fizică a degetului, de aceea 30/30 pe `chromium` nu l-au prins niciodată.

## Fix recomandat (o linie CSS, în ambele copii)

```css
.btn-scan{ ...; min-height:44px; min-width:44px; }
```

## Acoperire în teste

Testul din `mobil.spec.ts` e marcat `test.fail` — **alarmă inversă** (pattern DEFECT-001): cât timp defectul e deschis, suita e roșie cu intenție. Când dev aplică fix-ul CSS, testul va eșua cu „expected to fail but passed" — atunci ștergem adnotarea `test.fail` și DEFECT-003 trece în REZOLVAT, cu testul rămas în suită ca regresie permanentă.

## Context

Al doilea eșec din run #4 (`#btnGenereaza` disabled în „flux complet pe mobil") **nu** e defect de app — e bug în test (nu completa `contract_data`, pe care `valideaza()` îl cere non-vid). Se corectează în același PR, fără fișier de defect.
