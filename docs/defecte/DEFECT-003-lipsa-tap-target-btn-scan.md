# DEFECT-003 — Lipsă tap-target pe `.btn-scan` (38px < 44px)

- **Status:** ✅ REZOLVAT — 2026-11-12, run #7 (QA Console)
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

CSS-ul butonului nu avea `min-height`:

```css
.btn-scan{padding:10px 14px; font-size:15px; ...}  /* ≈ 38px computați */
```

Ghidul Android Material cere minim 44px (recomandat 48dp) pentru țintele de touch. Cu 38px, degetul ratează butonul de scanare — cel mai folosit buton din app pe mobil. Pe desktop defectul e invizibil pentru că nu există constrângerea fizică a degetului, de aceea 30/30 pe `chromium` nu l-au prins niciodată.

## Fix aplicat (o linie CSS, în ambele copii)

```css
.btn-scan{ ...; min-height:44px; min-width:44px; }
```

## Cum a fost detectată remedierea

Alarmă inversă (`test.fail`, pattern DEFECT-001/002): fix-ul CSS a fost aplicat, iar la run #7 testul a **trecut** cu 44px real — Playwright l-a raportat `unexpected` cu „expected to fail but passed". Exact semnalul proiectat. Adnotarea `test.fail` a fost ștearsă în același PR, iar testul e acum **regresie permanentă**: dacă butonul scade vreodată sub 44px, testul pică cu mesajul exact (`Received: 38`), fără să treacă neobservat.

## Context

Al doilea eșec din run #4 (`#btnGenereaza` disabled în „flux complet pe mobil") **nu** e defect de app — era bug în test (nu completa `contract_data`, pe care `valideaza()` îl cere non-vid). Corectat în PR-ul ciclului mobil, fără fișier de defect. Al doilea bug de test (CNP-uri hardcodate cu checksum greșit) a fost descoperit în run #5 și corectat cu `cnpValid()` în PR #25 — detaliat în comentariul din `mobil.spec.ts`.
