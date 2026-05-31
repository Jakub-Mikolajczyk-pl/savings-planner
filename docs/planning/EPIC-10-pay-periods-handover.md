# EPIC 10 — Silnik cykli „od wypłaty do wypłaty" (B2B-safe) — handover

> Dla modelu wykonującego. Samowystarczalny. Czytaj razem z `docs/planning/EPIC-8-bank-ingest.md`
> i `docs/planning/EPIC-9-categorization-handover.md` (na nich budujesz) oraz `ROADMAP-2026.md`.

## Cel

Granice cyklu budżetowego oparte o **wpływ** (income anchor), nie o dzień miesiąca — odpornie na
B2B (J1/J2, faktury w różnych terminach, czasem 2 strumienie). To fundament pod EPIC 11 (analiza
wycieku per cykl) i EPIC 12 (realne tempo celów / wolna gotówka per cykl).

## Stan wejściowy (co JUŻ istnieje — nie buduj od zera)

EPIC 8 i 9 są na branchu `feat/epic-9-categorization` (stackuje EPIC 8 + 9; `main` jeszcze ich nie
ma — patrz „Zależności"). Kluczowe artefakty:

- **Tabela `finance.transactions`** (V3 + V4). Kolumny istotne dla EPIC 10:
  `id bigint`, `account_id uuid`, `booked_at date`, `amount numeric(14,2)` (dodatnia = wpływ),
  `currency`, `description`, `counterparty`, `source`, `category_id`, `category_locked`, `created_at`.
  Indeksy: `booked_at`, `account_id`, `category_id`.
- **Schema = `finance`.** Migracje Flyway: istnieją **V1–V4** → następna to **V5**.
- **`IngestService.ingest(...)`** (`backend/.../ingest/IngestService.kt`) — `@Transactional`, pętla
  parse → upsert → `categorization.categorizeInsertedTransaction(...)`. **To jest punkt, w którym
  po imporcie należy odświeżyć mat-view `pay_periods`** (10.4). Wzór wstrzykiwania zależności:
  `IngestService` już dostaje `CategorizationService` przez konstruktor — analogicznie dołóż serwis
  cykli (albo wywołanie repo `refreshPayPeriods()`).
- **Wzorce backendu**: `CategorizationRepository` (`NamedParameterJdbcTemplate`, ręczne SQL, RowMapper)
  to wzór na repo czytające z views. `CategorizationController` (klasy `@RestController` w jednym pliku)
  to wzór na endpointy. DTO w `backend/.../dto/FinanceDtos.kt`. Błędy: `BadRequestException` /
  `NotFoundException` z `domain/Errors.kt` → `GlobalExceptionHandler` (400/404/422).
- **Front**: React 19 + TS + Zustand 5 (`src/store/index.ts`, slice z hydracją + optimistic sync),
  API client `src/api/client.ts`, typy `src/domain/types.ts`. Wzór sekcji UI:
  `src/components/categorization/CategorizationSection.tsx` (Collapsible). Selektor miesiąca jest
  dziś w widoku Planu/Harmonogramu — selektor cyklu wepnij obok/zamiast niego (10.5).

## Algorytm (sedno)

Na wierszach-przychodach (income anchor), posortowanych po `booked_at`:
```
period_start = anchor.booked_at
period_end   = lead(anchor.booked_at) over (order by booked_at)   -- następna kotwica; NULL = cykl otwarty
```
Przypięcie transakcji do cyklu: `period_start <= tx.booked_at < period_end` (range-join; ostatni
cykl `period_end IS NULL` łapie wszystko od ostatniej kotwicy).

**Guard `min_cycle_days`** (parametr, default 14): nie otwieraj nowego cyklu, jeśli od poprzedniej
kotwicy minęło < `min_cycle_days` — żeby druga faktura w tym samym oknie nie pocięła cyklu na pół.
Implementacja: przy budowie listy kotwic odrzucaj anchor, którego `booked_at - poprzedni_start <
min_cycle_days` (iteracyjnie, względem ostatnio ZAAKCEPTOWANEJ kotwicy, nie poprzedniego wiersza).

## Schema / obiekty (Flyway V5)

```sql
-- 10.1: które wpływy są kotwicą cyklu. Flaga na poziomie (account, counterparty).
create table finance.income_anchors (
    id           bigint generated always as identity primary key,
    account_id   uuid not null references finance.accounts(id) on delete cascade,
    counterparty text not null,            -- znormalizowany (lower, collapse spacji) jak w EPIC 9
    created_at   timestamptz not null default now(),
    unique (account_id, counterparty)
);

-- parametr min_cycle_days — albo prosta tabela ustawień, albo kolumna w settings.
-- Jeśli masz już finance.settings (sprawdź V1/V2), dołóż tam kolumnę min_cycle_days int default 14.

-- 10.2: pay_periods jako MATERIALIZED VIEW (refresh po ingest).
-- UWAGA: guard min_cycle_days trudny do wyrażenia czysto deklaratywnie window-funkcją
--        (zależność rekurencyjna od ostatnio zaakceptowanej kotwicy). Dwie drogi:
--   (A) policz kotwice w Kotlinie (czytelniej, „kod dydaktyczny") i zapisz do tabeli pay_periods,
--       odświeżając ją w transakcji po ingest;  ALBO
--   (B) mat-view z window function BEZ guardu + osobny krok scalający zbyt bliskie kotwice.
-- Rekomendacja: (A) — prościej przetestować i zgodne ze stylem repo (jawne SQL + logika w serwisie).
```

Jeżeli wybierzesz (A), `pay_periods` może być zwykłą tabelą przeliczaną przez `refreshPayPeriods()`:
`period_no int, account_id uuid, period_start date, period_end date NULL, anchor_tx_id bigint,
is_partial boolean` (pierwszy/ostatni cykl niepełny → `is_partial = true`).
`tx_with_period` (10.3) zostaje **viewem** (range-join `transactions` ↔ `pay_periods`).

## Zadania

- [ ] **10.1** `income_anchors` + UI/endpoint do oznaczania (counterparty per account jako kotwica).
  Detekcja-kandydatów: `amount > 0` zgrupowane po znormalizowanym `counterparty`, regularny rytm.
- [ ] **10.2** wyznaczanie `pay_periods` (rekomendacja: logika w Kotlinie + tabela) z window-logiką
  `lead()` i **guardem `min_cycle_days`** (parametr). Oznacz `is_partial` dla skrajnych cykli.
- [ ] **10.3** view `tx_with_period` — range-join transakcji do cyklu (`period_start <= booked_at <
  period_end`, ostatni cykl otwarty).
- [ ] **10.4** widok/endpoint per-cykl: `wpływ`, `wydatek`, `netto`; **refresh `pay_periods` po ingest**
  (w `IngestService`, w tej samej transakcji co import).
- [ ] **10.5** front: selektor cyklu obok/zamiast selektora miesiąca; podpięcie do store (slice +
  API client + typy lustrzane).

## Pułapki

- **NIE kotwicz na dniu miesiąca** — to B2B, nie etat. Granice wyłącznie z wpływów.
- Guard liczony względem ostatnio **zaakceptowanej** kotwicy, nie poprzedniego wiersza (inaczej seria
  bliskich faktur i tak potnie cykl).
- Spójna strefa czasowa `booked_at` (jest `date`, więc trzymaj się dat bez TZ).
- Pierwszy i ostatni cykl są niepełne → `is_partial`, żeby metryki w EPIC 11/12 ich nie mieszały.
- Refresh `pay_periods` musi być w transakcji ingestu — inaczej świeży import nie wpadnie do cyklu
  do następnego przeliczenia.
- Wiele rachunków: kotwice i cykle licz **per account** (chyba że właściciel chce skonsolidowany cykl
  — domyślnie per account, zgodnie z `account_id` w fingerprincie EPIC 8).

## Definition of Done

- Dla zadanego konta endpoint zwraca listę cykli (period_start/end, is_partial) + per-cykl wpływ/
  wydatek/netto.
- Druga faktura w oknie < `min_cycle_days` NIE tworzy nowego cyklu (pokryte testem).
- Recategorize/ingest odświeża cykle; przeliczenie idempotentne (te same dane → te same granice).
- Front pozwala wybrać cykl zamiast miesiąca.

## Zależności, branch, konwencje

- **Zależy od**: EPIC 8 (transakcje). Karmi EPIC 11 (rollup per cykl) i EPIC 12 (wolna gotówka per cykl).
- **Branch**: `feat/epic-10-pay-periods`. **Stackowanie**: EPIC 8 i 9 nie są jeszcze w `main`
  (`origin/main` = `dc85abc`). Zanim zaczniesz: albo poczekaj aż EPIC 8+9 wejdą do `main` i odbij od
  `main`, albo odbij od `feat/epic-9-categorization` i pamiętaj że PR pokaże też commity 8+9.
  **Ustal z właścicielem kolejność merge'y** (merge do `main` = deploy na savings.lan).
- **Dwa remoty**: pushuj na `origin` (GitHub Jakub-Mikolajczyk-pl) **i** `forgejo`
  (192.168.100.165:3000/jakub). PR na forgejo: `<forgejo>/compare/main...<branch>`.
- **Stos/testy**: Kotlin + Spring Boot, monorepo `backend/`, Flyway, Testcontainers PG17
  (`disabledWithoutDocker=true` → bez Dockera POMIJANE, przechodzą na CI). Logikę cykli (wyznaczanie
  granic + guard) pokryj **unit testami bez bazy** (wzór `RuleEngineTest`), a range-join/refresh —
  Testcontainers (wzór `CategorizationRepositoryTest`). Kod dydaktyczny (nauka Kotlina), zachowaj
  styl komentarzy „INTERVIEW Q". Po zakończeniu: lint/build/test zielone (front+backend), bez
  auto-merge do `main`.
