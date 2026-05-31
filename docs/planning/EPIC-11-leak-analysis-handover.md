# EPIC 11 — Analiza wycieku (gdzie i ile ucieka per cykl) + UI ingestu — handover

> Dla modelu wykonującego. Samowystarczalny. Czytaj razem z handoverami EPIC 8/9/10
> (`docs/planning/EPIC-8-bank-ingest.md`, `EPIC-9-categorization-handover.md`,
> `EPIC-10-pay-periods-handover.md`) i `ROADMAP-2026.md`.

## Zakres tego EPIC-a = DWIE rzeczy

1. **Analiza wycieku** (właściwy EPIC 11): rozłożyć wyciek na trzy soczewki w obrębie cyklu.
2. **UI ingestu bankowego** (dług domknięty tutaj): backend `POST /api/ingest` (EPIC 8) działa, ale
   NIE MA UI — dziś jedyny sposób importu wyciągu to ręczny curl. To blokuje realne użycie całej
   serii (bez transakcji nie ma czego analizować). Dlatego wpinamy je w EPIC 11 jako pierwszy krok.

---

## CZĘŚĆ A — UI ingestu (zrób NAJPIERW, odblokowuje resztę)

Cel: dialog/sekcja uploadu wyciągu z poziomu apki, na wzór `src/components/accounts/ImportCsvDialog.tsx`.

Artefakty (wszystko na forgejo/main, HEAD `7221b75`):
- Endpoint: `POST /api/ingest`, multipart `@RequestParam`: `bank` (`ALIOR_CSV`|`VELO_PDF`),
  `accountId` (UUID istniejącego konta), `file`. Zwraca `{inserted, skipped, bank, accountId}`.
  Idempotentny (fingerprint), po insercie auto-kategoryzuje (EPIC 9) i odświeża cykle (EPIC 10).
  Kontroler: `backend/.../controller/IngestController.kt`. Kontrakt: `docs/planning/EPIC-8-bank-ingest.md`.
- **WZÓR multipart już istnieje** w `src/api/client.ts`: `importApi.accountSnapshots()` buduje
  `FormData` i woła `request('/import/account-snapshots', {method:POST, body:formData})`. Dorób
  analogiczny `ingestApi.upload(bank, accountId, file)` → `POST /ingest`. UWAGA: `IngestController`
  używa `@RequestParam` (nie `@RequestPart`) — pola FormData: `bank`, `accountId` jako proste
  form-fields + `file`.
- Lista kont do selektora: `GET /api/accounts`. `accountId` musi być UUID istniejącego konta.

Zadania (A):
- [ ] `ingestApi` w `client.ts` (FormData; bank+accountId+file)
- [ ] dialog/sekcja: select banku (ALIOR_CSV/VELO_PDF) + select konta (z `/api/accounts`) + file
  input (`accept=".csv,.pdf"`) + przycisk; obsługa wyniku `{inserted, skipped}` i błędów 400/422
  (pusty plik / nieparsowalny wyciąg)
- [ ] po sukcesie odświeżyć listę transakcji (`transactionsApi.list`) i cykle (`payPeriodsApi`)
- [ ] gdzie wpiąć: zakładka „Transakcje" (jest już `TransactionsPage` w `src/App.tsx` z
  `PayPeriodsSection`) — dołóż tam `IngestDialog`/`IngestSection`

DoD (A): user wybiera bank+konto, wrzuca plik, widzi inserted/skipped, transakcje pojawiają się
skategoryzowane i wpadają do cykli.

> Istnieje już osobny task Todoist „UI do ingestu bankowego" (id 6gmJvVRcjcP3Vc3x) — to ta sama
> robota; potraktuj go jako część A tego EPIC-a (zamknij po zrobieniu).

---

## CZĘŚĆ B — Analiza wycieku per cykl

### Stan wejściowy (co JUŻ istnieje — nie buduj od zera)

- **`finance.transactions`** (V3+V4): `amount` (dodatnia=wpływ, ujemna=wydatek), `category_id`
  (FK, nullable), `category_locked`. Kategorie: `finance.categories(id, name, kind, parent_id)`,
  gdzie `kind ∈ {variable, fixed, recurring}` (V4).
- **`finance.pay_periods`** + **view `finance.tx_with_period`** (V5) — range-join transakcji do cyklu;
  ma kolumny: wszystkie z `transactions` + `period_no, period_start, period_end, is_partial`. To jest
  Twój główny punkt wejścia (cykle × transakcje × kategorie w jednym).
- **`PayPeriodRepository.listPayPeriods()`** liczy już `income/expense/net` per cykl — wzór agregacji
  per-period przez `tx_with_period`. Repo/serwis/kontroler w `backend/.../payperiod/`.
- Front: zakładka „Transakcje" (`TransactionsPage` w `src/App.tsx`), `payPeriodsApi` w `client.ts`,
  store w `src/store/index.ts`, typy `src/domain/types.ts`. Wzór sekcji: Collapsible / `SectionCard`.

Migracje Flyway: istnieją **V1–V5** → następna to **V6**. Schema = `finance`.

### Zadania (B)

- [ ] **11.1** view `cycle_category_rollup` (pay_periods × categories): suma + count per kategoria per
  cykl. Buduj na `tx_with_period` join `categories`. Uwaga: transakcje z `category_id IS NULL` i te
  przed pierwszą kotwicą (poza cyklem, `period_no IS NULL` w tx_with_period) — zdecyduj jawnie czy
  trafiają do koszyka „bez kategorii"/„poza cyklem" i pokaż to (inaczej sumy nie zgadzają się z netto).
- [ ] **11.2** soczewka **RECURRING**: znormalizowany counterparty (jak `normalizeCounterparty` z
  EPIC 10) + podobna kwota (±tolerancja) + miesięczny rytm + ≥3 wystąpienia → flaga recurring; osobny
  widok subskrypcji. (Niezależne od `kind=recurring` z kategorii — to detekcja z danych.)
- [ ] **11.3** soczewka **ŚMIERĆ OD TYSIĄCA CIĘĆ**: suma + count transakcji `abs(amount) < 50 zł`
  per kategoria per cykl.
- [ ] **11.4** soczewka **DELTA**: kategoria vs średnia z 3 poprzednich cykli → największe wzrosty.
  (Cykle bierz po `period_no` malejąco; pomiń `is_partial` w baseline, żeby niepełne nie zaniżały.)
- [ ] **11.5** front: dashboard cyklu — top kategorie (bar), lista recurring, agregat mikro-wydatków,
  delta-highlights. Selektor cyklu jest już w `PayPeriodsSection` — podłącz się pod wybrany cykl.
- [ ] **11.6** (opcj.) alert recurring/wzrost → Todoist (wpina się w EPIC 7.5).

### DoD (B)

Dla wybranego cyklu zwraca: top kategorie (suma+count), listę recurring, agregat mikro-wydatków
(<50 zł), kategorie z największym wzrostem vs baseline 3 cykli.

### Pułapki

- **Spójność z netto**: suma rollupów musi dać się pogodzić z `net` cyklu z EPIC 10. Transakcje
  uncategorized i poza-cyklowe muszą być widoczne, nie „zniknąć".
- `is_partial` cykle (pierwszy/ostatni) zaniżają/zawyżają — oznaczaj w UI i wyłączaj z baselineu delty.
- Recurring detection ≠ `kind=recurring`. Pierwsze to heurystyka z danych (11.2), drugie to etykieta
  kategorii. Nie myl.
- Tolerancja kwoty dla recurring: abonamenty drgają (kurs, promocje) — daj ± kilka %, nie równość.

---

## Zależności, branch, konwencje

- **Zależy od**: EPIC 9 (kategorie) + EPIC 10 (cykle) — oba na forgejo/main. Karmi EPIC 12.
- **Branch**: `feat/epic-11-leak-analysis`. Odbij od **forgejo/main** (`7221b75`) — tam jest cała seria
  8–10. UWAGA: `origin/main` (GitHub) jest w tyle (`dc85abc`, brak 8/9/10) — **forgejo jest źródłem
  prawdy dla main**. Pushuj branch na oba remoty.
- **Merge do `main` (forgejo) = produkcyjny deploy** na savings.lan (CD z EPIC 5, CT111). Bez
  auto-merge bez zgody właściciela.
- **Stos/testy**: Kotlin + Spring Boot, monorepo `backend/`, Flyway (następna V6), Testcontainers PG17
  (`disabledWithoutDocker=true` → bez Dockera POMIJANE; na tym hoście dev Testcontainers i tak nie
  startują lokalnie — licz na CI). Logikę soczewek (recurring/delta) pokryj **unit testami bez bazy**
  (wzór `PayPeriodEngineTest`), a rollup/view — Testcontainers (wzór `PayPeriodRepositoryTest`).
- Kod dydaktyczny (nauka Kotlina), zachowaj styl komentarzy „INTERVIEW Q". Po zakończeniu:
  lint/build/test zielone (front+backend).
