# Progres — QA Automation Framework

Document viu: ce am livrat, în ce ordine, cu ce rezultat. Se actualizează la fiecare sesiune.

## Stare — 2026-11-12

- Toate PR-urile sunt **merge-uite în `main`**, CI **verde** (ultima rulare CI pe branch: ~1 min).
- Consola QA rulează pe server (systemd, `127.0.0.1:3200`, acces doar prin tunel SSH).
- Repo-ul e sursa de adevăr; serverul se sincronizează din repo.
- Suita CompleActe: **19/19 passed** pe `main` (32.9s) — toate ecranele + generarea PDF acoperite.
- DEFECT-001 (lipsa butonului spre «Verificare») și DEFECT-002 (ș/ț omoară generarea PDF) rămân deschise, fiecare sub observație automată dublă (teste `test.fail`).

## Livrat, în ordine

### 1. Framework de bază
- Playwright (UI) + API (postman-playwright) + DB (MySQL ephemeral) — buclă închisă pe trei straturi.
- `globalSetup` pornește singur aplicația demo și MySQL. Local: `npm install` → `npm test`.
- CI pe GitHub Actions (Node 24, Chromium, raport HTML ca artifact).

### 2. Consola QA (`qa-console/`)
- Server Express + `node:sqlite`, localhost-only (`127.0.0.1:3200`).
- Declanșare suite din browser (▶), jurnal live, istoric persistat, grafic trend (pass/fail/durată).
- Curățenie automată istoric (max 50 la boot + buton de curățare).
- Run-uri orfane → marcate `interrupted` la pornire.
- Raportul HTML Playwright al ultimului run e servit la `/report/`.

### 3. Suita CompleActe (PR #9)
- `tests/compleacte/ui.spec.ts` — 4 teste: health, smoke, flux (acord → Continuă → ecranul 2 „Date”), negativ.
- App-ul e servit de un server static local (port aleator), pornit/oprit de suită.
- `www/` nu e în repo (cheie API hardcodată); pe server: `/opt/qa/compleacte-www`.
- Fără `www/` (ex. CI) → SKIP, nu FAIL.
- `db.fixture.ts`: `tests/compleacte` nu necesită MySQL.
- Rezultat pe server: 4/4 passed în 4.6s.

### 4. Consola lansează CompleActe (PR #10)
- Whitelist `POST /api/run` + dropdown: `tests/compleacte` apare lângă `tests/ai`.
- CI fix: `npx playwright install chromium` (fără `--with-deps`) — elimină blocarea la apt/DNS pe runner.

### 5. Mentenanță server
- Recuperat ~16 GB disc: syslog-uri truncate (crash-loop consola), cache npm/Playwright root curățate, browsere root șterse.
- Consola repornită ca serviciu, funcțională din nou.

### 6. Suita ecranului 3 «Verificare» (PR #13)
- `tests/compleacte/verificare.spec.ts` — 5 teste: randare ecran 3 + pas activ, copiere `fix-s3-copiere` (oglinzi `#s3` = `#s2`), gating `#btnGenereaza` blocat/`#avertisment` vizibil, gating deblocat cu date valide, curățare `.gresit` după revalidare.
- **Intrare chirurgicală** `laVerificare()` prin `page.evaluate()` — suita rulează AZI, chiar dacă DEFECT-001 (lipsa butonului) e deschis; la fix-ul dev-ului, testul `test.fail` din `date.spec.ts` va începe să treacă → „expected to fail but passed" → alarmă automată inversă.
- CNP-urile de test sunt **generate** cu algoritmul app-ului (`cnpValid()`), cifra de control calculată — nu hardcodate.
- Ciclu complet: branch → 2 fix-uri mid-flight corectate din feedback real al rulării → PR #13 → CI verde → merge → **14/14 passed pe main (22.4s)**.

#### Lecții din ciclu (portfolio material)
- **Guardul `cnpValid()` și-a prins propriul autor**: baza de test cu 13 cifre (în loc de 12) a fost respinsă la încărcarea fișierului, înainte de rulare — validarea intrărilor de test contează la fel ca cea de producție; pică devreme, pică zgomotos.
- **Playwright respinge `fill()` pe elemente ascunse**: `laVerificare()` → `arata(3)` ascunde `#s2`, deci testul care completează `#s2` trebuie întâi să revină cu `arata(2)` — testele respectă aceleași reguli ca utilizatorul real (niciun `fill()` pe ce nu se vede).

### 7. Notificare dev despre DEFECT-001
- Mesaj de înștiințare pregătit (link la `docs/defecte/DEFECT-001-lipsa-buton-verificare.md` + explicația alarmei automate inverse), trimis de utilizator echipei de dev.
- DEFECT-001 va fi închis de fix-ul dev-ului; detectarea e automată prin cele două alarme instalate (testul `test.fail` + suita ecran 3).

### 8. Suita generării contractului PDF (PR #15)
- `tests/compleacte/contract.spec.ts` — 5 teste pentru `genereazaContract()`:
  1. **Descărcare** — click pe `#btnGenereaza` produce fișierul cu numele corect (`{def.id}-{AAAA-LL-ZZ}.pdf`), verificat cu `page.waitForEvent('download')`.
  2. **Conținut** — fișierul descărcat e PDF real: magic bytes `%PDF-` + dimensiune > 1000 bytes.
  3. **DEFECT-002** (`test.fail`) — date cu „București" → așteaptă exact alerta `Eroare la generare: WinAnsi cannot encode`; la fix-ul dev-ului, „expected to fail but passed" → semnal de scoatere a marcajului.
  4. **Negativ** — fără formular (`DEFINITIE_FORMULAR = null`): alertă „Nu există formular încărcat.", nu crash.
  5. **Negativ** — `completeazaFormular()` suprascris să arunce → eroarea devine alertă prin catch-ul din `genereazaContract()`.
- **DEFECT-002 descoperit de această suită**: pdf-lib cu font standard encodează în WinAnsi, care nu conține ș (U+0219) / ț (U+021B) — orice utilizator real care scrie „București", „Reșița" etc. nu poate genera contractul. Document complet: `docs/defecte/DEFECT-002-pdf-wiansi-si-t.md`. Fix recomandat: `@pdf-lib/fontkit` + TTF Unicode, sau transliterare ca fallback.
- Testele pozitive folosesc date WinAnsi-safe (fără ș/ț) — dovedesc că fluxul complet de descărcare funcționează în condițiile actuale ale app-ului.
- Ciclu complet: branch → rulare → diagnostic instrumentat din feedback real → suita documentează defectul în loc să-l ocolească → PR #15 → merge → **19/19 passed pe main (32.9s)**.

#### Lecții din ciclu (portfolio material)
- **Alertele mute ascund defecte reale**: în Playwright, o `alert()` fără handler e respinsă automat și în tăcere — la prima rulare, timeout-ul descărcării spunea doar „Timeout 30000ms exceeded", iar eroarea reală (WinAnsi) era invizibilă. Fix: **instrumentează testul să-ți spună ce s-a întâmplat în pagină** (colectarea dialogurilor + `pageerror` + `console.error` în mesajul de failure) — nu ghici.
- **Suita descoperă defecte de produs, nu doar le confirmă**: cu date realiste („București"), suita a găsit un blocaj pe care niciun test cu date ASCII nu l-ar fi prins — alegerea datelor de test e ea însăși o decizie de design.
- **Documentează defectul în cod, cu alarmă**: un `test.fail` cu mesajul exact așteptat transformă remedierea dev-ului în eveniment observabil automat — „expected to fail but passed" e semnalul, nu un eșec al suitei.

## Următorii pași (propuși, neîncepuți)

- ~~Suită pentru ecranul 2 „Date": validare câmpuri obligatorii, flux înainte, navigare înapoi.~~ → **livrat în PR #12** (via `date.spec.ts`).
- ~~Suită pentru ecranul 3 „Verificare".~~ → **livrat în PR #13** (secțiunea 6).
- ~~Teste pentru `genereazaContract()` (PDF-ul propriu-zis).~~ → **livrat în PR #15** (secțiunea 8).
- Notificare dev despre DEFECT-001 + DEFECT-002: mesaj pregătit, trimis de utilizator (link-uri la ambele documente + explicația alarmelor automate inverse).
- Raport remediere la test picat: descriere, pași reproducere, așteptat vs. obținut, cauză, plan fix, retest — fără a modifica automat aplicația testată.
- După fix-ul DEFECT-001/002 de către dev: verificare că testele `test.fail` încep să treacă („expected to fail but passed"), scoaterea marcajelor, închiderea defectelor.

## Regulile proiectului

1. Nu ștergem și nu rescriem ce funcționează.
2. Îmbunătățim doar după verificare, incremental, reversibil.
3. Testele existente rămân verzi.
4. Repo-ul e sursa de adevăr; serverul se sincronizează din repo (`git pull` + sync consola).
