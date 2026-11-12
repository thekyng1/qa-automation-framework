# Progres — QA Automation Framework

Document viu: ce am livrat, în ce ordine, cu ce rezultat. Se actualizează la fiecare sesiune.

## Stare — 2026-11-12 (final de zi)

- Toate PR-urile ciclului mobil sunt **merge-uite în `main`**: **#23** (suita mobilă), **#24** (DEFECT-003 + fix `contract_data`), **#25** (CNP-uri generate); **#26** (închiderea DEFECT-003) e deschis pentru merge.
- **DEFECT-001, DEFECT-002 și DEFECT-003 sunt REZOLVATE** — toate trei sub **regresie permanentă**, nu doar sub alarmă inversă.
- Suita CompleActe: **67/67 passed** pe 2 proiecte — `chromium` 30 + `mobile-chrome` 37 (Pixel 7, 412px, touch) — zero alarme inverse active.
- Fluxul complet CompleActe funcționează end-to-end pe desktop și mobil: Acord → Date → Verificare → **PDF cu diacritice**.
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

### 6. Suita ecranului 3 «Verificare» (PR #13)
- `tests/compleacte/verificare.spec.ts` — 5 teste: randare ecran 3 + pas activ, copiere `fix-s3-copiere` (oglinzi `#s3` = `#s2`), gating `#btnGenereaza` blocat/`avertisment` vizibil, gating deblocat cu date valide, curățare `.gresit` după revalidare.
- **Intrare chirurgicală** `laVerificare()` prin `page.evaluate()` — suita rulează AZI, chiar dacă DEFECT-001 (lipsa butonului) e deschis; la fix-ul dev-ului, testul `test.fail` din `date.spec.ts` va înceapă să treacă → „expected to fail but passed\" → alarmă automată inversă.
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
  3. **DEFECT-002** (`test.fail`) — date cu „București\" → așteaptă exact alerta `Eroare la generare: WinAnsi cannot encode`; la fix-ul dev-ului, „expected to fail but passed\" → semnal de scoatere a marcajului.
  4. **Negativ** — fără formular (`DEFINITIE_FORMULAR = null`): alertă „Nu există formular încărcat.\", nu crash.
  5. **Negativ** — `completeazaFormular()` suprascris să arunce → eroarea devine alertă prin catch-ul din `genereazaContract()`.
- **DEFECT-002 descoperit de această suită**: pdf-lib cu font standard encodează în WinAnsi, care nu conține ș (U+0219) / ț (U+021B) — orice utilizator real care scrie „București", „Reșița\" etc. nu poate genera contractul. Document complet: `docs/defecte/DEFECT-002-pdf-wiansi-si-t.md`.
- Testele pozitive folosesc date WinAnsi-safe (fără ș/ț) — dovedesc că fluxul complet de descărcare funcționează în condițiile actuale ale app-ului.
- Ciclu complet: branch → rulare → diagnostic instrumentat din feedback real → suita documentează defectul în loc să-l ocolească → PR #15 → merge → **19/19 passed pe main (32.9s)**.

#### Lecții din ciclu (portfolio material)
- **Alertele mute ascund defecte reale**: în Playwright, o `alert()` fără handler e respinsă automat și în tăcere — la prima rulare, timeout-ul descărcării spunea doar „Timeout 30000ms exceeded", iar eroarea reală (WinAnsi) era invizibilă. Fix: **instrumentează testul să-ți spună ce s-a întâmplat în pagină** (colectarea dialogurilor + `pageerror` + `console.error` în mesajul de failure) — nu ghici.
- **Suita descoperă defecte de produs, nu doar le confirmă**: cu date realiste („București"), suita a găsit un blocaj pe care niciun test cu date ASCII nu l-ar fi prins — alegerea datelor de test e ea însăși o decizie de design.
- **Documentează defectul în cod, cu alarmă**: un `test.fail` cu mesajul exact așteptat transformă remedierea dev-ului în eveniment observabil automat — „expected to fail but passed\" e semnalul, nu un eșec al suitei.

### 9. Suita scanării OCR (PR #17 + PR #18)
- `tests/compleacte/scan.spec.ts` — 11 teste, pe trei straturi de adâncime:
  - **A. Parsare pură (6)** — funcțiile „PURA” expuse public (`OCR.parseazaTalon`, `parseazaCI`, `referinteCI`, `MRZ.dinText`, `MRZ.valideazaCNP`), fără rețea și fără DOM: talon (VIN 17/placă/an/marcă/tip), CI fallback pe referințe (nume Title Case, CNP valid, serie, nr, județ, localitate), bandă MRZ sintetică, cifră de control CNP corectă vs. greșită, negativ „DEPANARE TALON\".
  - **B. UIB (1, dens)** — `UIB.populeazaFormular` pe câmpuri sintetice `tst_`: prefix, sare readonly și încearcă candidatul următor, **izolează `#s3`** (ecranul 3 nu e atins la scanare — cerință din ui-binder.js), aliasuri (`serie` → `serie_buletin`), `diagnostic()` scrise/lipsă.
  - **C. E2E cu Vision mock-uit (3)** — `page.route()` pe endpointul Google Vision; `scanCI` cu `UIB.populeazaFormular` ca aplicator → 6/6 câmpuri scrise în formular; negativele: lipsă cheie → reject „LIPSA CHEIE\"; cheie respinsă de Google (HTTP 400 „API key not valid\") → mesajul „Cheia Google Vision este INVALIDA\", nu crash.
  - **D. Declanșare din buton (1)** — click pe `.btn-scan` → `filechooser` (fallback desktop `alegeImagine`).
- **Zero apeluri reale către Google Vision** (cheie/cost/rețea), zero fișiere imagine externe (canvas sintetic la runtime), prefixe `tst_`/`e2e_` care nu colizionează cu formularul real (`v_`/`c_`/`m_`).
- **Ipoteza DEFECT-003 a fost infirmată**: se suspectase că `SCUI.init()` (rulat la `DOMContentLoaded`) nu se leagă pe butoanele `.btn-scan` randate asincron de form-engine. Testul D a trecut — cronometrarea e corectă, nu există defect. Ipoteză documentată în cod, testată, eliminată.
- Ciclu complet: explorare statică (`cat`/`grep` pe cele 4 module OCR) → branch → PR #17 (merge) → rulare 10/11 → diagnostic (aserțiune greșită în test, parserul app-ului era corect) → PR #18 fix → **11/11 passed (9.4s)**. **30/30 pe main.**

#### Lecții din ciclu (portfolio material)
- **Citește codul înainte să testezi**: întreaga strategie a suitei a rezultat din explorarea statică — funcțiile „PURA” expuse public au permis 6 teste fără mock; aplicatorul injectabil al `scanCI` a permis e2E fără modificarea app-ului; endpointul unic Vision a făcut un singur `page.route` suficient.
- **Când un test pică, întâi întreabă: cine greșește — testul sau app-ul?** Prima rulare a picat pe `serie: 'XX' vs 'AB'`; regexul real din `mrz.js` consumă codul țării în grupa necapturată și capturează seria `AB` — parserul era corect, aserțiunea mea interpreta greșit formatul TD1. Diagnoza corectă a evitat un raport de defect fals către dev.
- **Formulează ipoteze de defect, apoi testează-le explicit**: DEFECT-003 nu a fost niciodată „raportat\" — a fost o ipoteză încapsulată într-un test; când testul a trecut, ipoteza a murit singură, cu dovezi. Un QA bun ține ipotezele de defect ca pe niște pariuri verificabile, nu ca pe niște acuzații.

### 10. Închiderea DEFECT-001 — fix-ul dev-ului prins de alarmă inversă (PR #20)
- Dev-ul a adăugat butonul `laVerificare()` în `#s2` (după `#form-container`, în `index.html`, ambele copii ale app-ului).
- Alarmă inversă a declanșat exact cum a fost proiectată: testul `test.fail` din `date.spec.ts` a trecut cu „expected to fail but passed" → adnotarea ștearsă, testul promovat în **regresie permanentă** („formularul are buton spre ecranul «Verificare»").
- `docs/defecte/DEFECT-001-lipsa-buton-verificare.md` — secțiune `STATUS: ✅ REZOLVAT — 2026-11-12` cu fix-ul și dovada automată.
- Impact: utilizatorul ajunge acum pe ecranul «Verificare» prin UI normal, fără intrare chirurgicală.

### 11. Închiderea DEFECT-002 — cauza root găsită prin diagnostic, fix de o linie (PR #21)
- **Cauza root** (diagnostic complet, în docs/defecte): infrastructura de embeduire a fontului exista deja în `lib/pdf-generator.js` (fontkit încărcat, `lib/fonts/arial.ttf` prezent — 1.045.960 bytes cu diacritice, `embedFont(b, {subset:true})` + `form.updateFieldAppearances(font || undefined)`), dar lanțul era mort dintr-o singură linie: condiția de la pdf-generator.js:42 **verifica** existența metodei `doc.registerFontkit`, fără să o **apeleze** → `embedFont` arunca → `.catch(() => null)` înghițea tăcut eroarea → `font === null` → font standard WinAnsi → ș/ț omoară generarea.
- Fix-ul dev-ului (o linie, ambele copii ale app-ului): `if (doc.registerFontkit && window.fontkit) doc.registerFontkit(window.fontkit);` — înainte de `embedFont`.
- Alarmă inversă a declanșat: `1 failed` cu „expected to fail but passed" pe `contract.spec.ts` — semnalul exact așteptat.
- Testul DEFECT-002 promovat în **regresie permanentă**: acum completează `contract_loc: "București"` (ș U+0219, ț U+021B) și asertează că PDF-ul **se descarcă** și că **zero** alerte „Eroare la generare" apar. Dacă fontul WinAnsi revine vreodată, testul pică cu mesajul real din pagină, colectat automat.
- `docs/defecte/DEFECT-002-pdf-wiansi-si-t.md` — cauza root + `STATUS: ✅ REZOLVAT — 2026-11-12` + lecții.
- Verificare finală pe `main`: **30/30 passed (35.7s)**, zero alarme inverse active.

#### Lecții din ciclu (portfolio material)
- **O eroare înghițită tăcut face ca un defect de o linie să arate ca un mister de font**: lanțul pregătit perfect (fetch TTF → embedFont → updateFieldAppearances) nu rula din cauza unui singur apel lipsă, iar `.catch(() => null)` masca exact acel apel. Fallback-urile care înghit erori merită `console.warn` — altfel devin capcane de diagnostic.
- **Alarmă inversă funcționează ca mecanism de livrare, nu doar de detecție**: de două ori azi, remedierea dev-ului a fost *observată automat* de suită, iar promovarea din `test.fail` în regresie a transformat fix-ul în pavaj permanent — regresia nu mai depinde de vigilența nimănui.
- **Diagnosticul înainte de fix**: am citit lanțul real din pdf-generator.js (condiție, catch tăcut, fallback `font || undefined`) înainte să propunem remedierea — fix-ul de o linie a rezultat direct din înțelegerea codului, nu din ghicit.

### 12. Ciclul mobil — de la zero la DEFECT-003 închis (PR #23, #24, #25, #26)
- **Suita mobilă** (PR #23): proiect `mobile-chrome` în `playwright.config.ts` (Pixel 7, hasTouch, isMobile, viewport 412x915) + `tests/compleacte/mobil.spec.ts` — 7 teste: health overflow la 412px, flux acord cu tap, negativ fără acord, tap-target `.btn-scan`, tap-target Continuă/Verifică, filechooser la tap pe `.btn-scan`, flux complet formular valid → PDF descărcat. Suita CompleActe: de la 30 la **67 de teste** (30 desktop + 30 re-rulate la 412px + 7 noi).
- **Run #4 (prima rulare mobilă): 35/37** — și aici e valoarea ciclului: 30/30 pe desktop nu prinseseră nimic, dar la 412px cu touch au apărut 2 probleme: un **defect real** (`.btn-scan` 38px < 44px Android Material — **DEFECT-003**, invizibil pe desktop) și un **bug de test** (`contract_data` necompletat, cerut non-vid de `valideaza()`). DEFECT-003 documentat în `docs/defecte/` cu alarmă inversă `test.fail` (PR #24).
- **Run #5: 36/37** — al doilea bug de test: CNP-urile hardcodate aveau checksum greșit (2930525123457 → cifra corectă e 1) și `valideaza()` le respingea. Corectat cu `cnpValid()` — generare cu algoritmul app-ului (PR #25).
- **Run #6: 37/37 expected** — suita mobilă complet verde, cu DEFECT-003 ținut sub alarmă (roșu intenționat, singurul „eșec" fiind testul care trecea funcțional).
- **Fix-ul dev (o linie CSS, ambele copii ale app-ului): `min-height:44px; min-width:44px`** → **run #7: alarma a declanșat exact ca la DEFECT-001/002** — testul tap-target a trecut cu 44px real, Playwright a raportat „expected to fail but passed". PR-ul de închidere (#26): adnotarea `test.fail` ștearsă, testul promovat în **regresie permanentă**, DEFECT-003 → REZOLVAT, acest document actualizat.

#### Lecții din ciclu (portfolio material)
- **Cea mai valoroasă pereche e „defect real + bug de test" în același run** (run #4): unul a devenit DEFECT-003, documentat cu alarmă; celălalt, diagnosticat corect (testul greșea, nu app-ul), a evitat un raport de defect fals către dev. „Cine greșește — testul sau app-ul?" rămâne prima întrebare a oricărei depanări.
- **CNP-urile de test se generează, nu se scriu de mână** (run #5): un checksum calculat „cu ochiul" a respins un formular altfel valid — din nou testul, nu app-ul, era de vină. Datele de test care trec printr-un algoritm de validare trebuie produse de același algoritm.
- **Alarma inversă, a treia oară confirmată ca mecanism de livrare**: DEFECT-001, DEFECT-002, DEFECT-003 — toate trei închise prin același pattern: documentat cu `test.fail` → fix dev → „expected to fail but passed" → promovare automată în regresie permanentă. Fix-ul dev-ului a fost observat fără nicio vigilență umană.
- **Desktop-ul nu poate prinde defecte de deget**: 38px vs 44px nu există la mouse; proiectul `mobile-chrome` a prins defectul din primul run. Pentru un app Capacitor, o suită verde pe un singur proiect e doar jumătate de suită.

## Următorii pași (propuși, neîncepuți)

- ~~Suită pentru ecranul 2 „Date".~~ → **livrat în PR #12** (via `date.spec.ts`).
- ~~Suită pentru ecranul 3 «Verificare».~~ → **livrat în PR #13** (secțiunea 6).
- ~~Teste pentru `genereazaContract()` (PDF-ul propriu-zis).~~ → **livrat în PR #15** (secțiunea 8).
- ~~Suită pentru scanarea OCR.~~ → **livrat în PR #17 + PR #18** (secțiunea 9).
- ~~Notificare dev despre DEFECT-001 + DEFECT-002.~~ → **trimisă** (secțiunea 7).
- ~~Verificare că testele `test.fail` încep să treacă la fix-ul dev-ului, scoaterea marcajelor, închiderea defectelor.~~ → **DEFECT-001, DEFECT-002 și DEFECT-003 închise** (secțiunile 10, 11 și 12).
- ~~**Testare mobilă** (viewport/touch în Playwright).~~ → **livrată** (PR #23–#26, secțiunea 12).
- **Verificare pe telefon fizic** (build Capacitor pe Android real): camera cu `.btn-scan` la noile 44px, PDF salvat în Documents, share nativ — pasul pe care niciun Playwright nu-l poate face.
- **OCR cu fotografii reale** — extensie naturală a suitei OCR actuale (acum doar canvas sintetic).
- Raport remediere la test picat: descriere, pași reproducere, așteptat vs. obținut, cauză, plan fix, retest — fără a modifica automat aplicația testată.

## Regulile proiectului

1. Nu ștergem și nu rescriem ce funcționează.
2. Îmbunătățim doar după verificare, incremental, reversibil.
3. Testele existente rămân verzi.
4. Repo-ul e sursa de adevăr; serverul se sincronizează din repo (`git pull` + sync consola).
