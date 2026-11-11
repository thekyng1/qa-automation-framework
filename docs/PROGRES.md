# Progres — QA Automation Framework

Document viu: ce am livrat, în ce ordine, cu ce rezultat. Se actualizează la fiecare sesiune.

## Stare — 2026-11-11

- Toate PR-urile sunt **merge-uite în `main`**, CI **verde**.
- Consola QA rulează pe server (systemd, `127.0.0.1:3200`, acces doar prin tunel SSH).
- Repo-ul e sursa de adevăr; serverul se sincronizează din repo.

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

## Următorii pași (propuși, neîncepuți)

- Suită pentru ecranul 2 „Date”: validare câmpuri obligatorii, flux înainte, navigare înapoi.
- Raport remediere la test picat: descriere, pași reproducere, așteptat vs. obținut, cauze, plan fix, retest — fără a modifica automat aplicația testată.

## Regulile proiectului

1. Nu ștergem și nu rescriem ce funcționează.
2. Îmbunătățim doar după verificare, incremental, reversibil.
3. Testele existente rămân verzi.
4. Repo-ul e sursa de adevăr; serverul se sincronizează din repo (`git pull` + sync consola).
