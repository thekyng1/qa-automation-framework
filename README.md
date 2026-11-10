# QA Automation Framework

![QA Console — live ops](docs/console.png)

Framework de testare automată în **buclă închisă pe trei straturi**: aplicația e lovită simultan la UI, API și bază de date, iar rezultatul se vede live în consola de mai sus.

## Ce este

Un setup de QA automation complet funcțional: pornește singur o aplicație demo și un MySQL ephemeral (via `globalSetup`), rulează suita pe trei straturi cu aserțiuni reale, și produce raport HTML + rezultate structurate. Gândit pentru a demonstra nu doar „teste care trec", ci o **buclă închisă**: declanșare → execuție → jurnal live → raport → istoric.

## Arhitectura — trei straturi

| Strat | Tool | Ce validează |
|---|---|---|
| UI | Playwright | fluxuri de utilizator real în browser, cu așteptări explicite |
| API | `postman-playwright` + validare `pm.test` | captură de trafic în timpul testelor UI + aserțiuni în stil Postman, în aceeași sesiune |
| DB | MySQL | aserțiuni de persistență într-o conexiune separată de cea a aplicației |

API-ul e verificat **capturând traficul generat chiar de pașii UI** — nu există dubluri de „teste API separate", ci o singură buclă coerentă.

## Where it runs

- **Local, oriunde**: clonat → `npm install` → `npm test`. Atât — aplicația demo și MySQL-ul ephemeral sunt pornite automat de `globalSetup`.
- **Live ops**: consola din screenshot rulează pe un server Ubuntu (aarch64) ca serviciu `systemd`, cu jurnal live și istoric al run-urilor persistat în SQLite (`node:sqlite`). Acces se face prin SSH tunnel — fără expunere publică.

### Consola (qa-console/)

Codul consolei live din screenshot e în repo: server Express + `node:sqlite` + UI cu grafic de trend (pass/fail/durată) și curățenie automată a istoricului.
Local, suita de teste nu depinde de ea — e componenta de live ops.
Deploy: `npm install` în `qa-console/` + serviciu `systemd` legat de `127.0.0.1` (acces doar prin tunel SSH).

## Raport

Playwright generează raport HTML la fiecare run (`playwright-report/`), mereu la zi cu ultimul run — vizibil direct din consola live.

## Roadmap

- grafic de trend în consola live (pass/fail/durată în timp)
- curățenie automată a istoricului


