# EPIC 9 — Kategoryzacja (reguły + LLM fallback) — handover

> Dla modelu wykonującego. Samowystarczalny. Czytaj razem z `docs/planning/EPIC-8-bank-ingest.md`
> (na nim budujesz) i `docs/planning/ROADMAP-2026.md` (miejsce w serii 8–12).

## Cel

Każdej transakcji nadać kategorię — **deterministycznie i tanio regułami**, a LLM odpalać
**tylko na resztę** (uncategorized). Werdykt LLM materializuje się jako nowa reguła (cache),
więc LLM uruchamia się coraz rzadziej.

## Stan wejściowy (co JUŻ istnieje po EPIC 8 — nie buduj od zera)

EPIC 8 jest na branchu `feat/epic-8-bank-ingest` (origin + forgejo zsynchronizowane). Po jego
zmergowaniu do `main` masz realne transakcje w `finance.transactions`. Kluczowe artefakty, na
których budujesz:

- **Tabela `finance.transactions`** — `backend/src/main/resources/db/migration/V3__bank_ingest.sql`.
  Kolumna **`category_id bigint` JUŻ ISTNIEJE** (nullable, BEZ FK). 9.1 dokłada tylko tabele
  słownikowe i ograniczenie FK — nie dodawaj kolumny drugi raz.
- **Kanoniczny DTO** `CanonicalTx` — `backend/src/main/kotlin/pl/jakubmikolajczyk/savings/ingest/BankStatementAdapter.kt`:
  ```kotlin
  data class CanonicalTx(
      val bookedAt: LocalDate,
      val amount: BigDecimal,
      val currency: String,
      val description: String,   // materiał do match_field='description'
      val counterparty: String?, // materiał do match_field='counterparty' (bywa null)
      val raw: Map<String, Any?>,
  )
  ```
  Uwaga: `accountId` i `source` NIE są polami `CanonicalTx` — dochodzą dopiero przy zapisie
  (`TransactionInsert` / fingerprint w `IngestService`).
- **`IngestService`** (`.../ingest/IngestService.kt`) — pętla `adapter.parse → fingerprint(tx, accountId)
  → transactions.insertIgnoreDuplicate(...)`. To naturalny punkt zaczepienia kategoryzacji „przy ingest" (9.2).
  `insertIgnoreDuplicate` zwraca `Boolean` (czy wstawiono) — wiesz które wiersze są świeże.
- **`TransactionUpsertRepository`** — `NamedParameterJdbcTemplate`, `INSERT ... ON CONFLICT (fingerprint)
  DO NOTHING`. Wzór na repo dla `UPDATE ... SET category_id`.
- **`IngestController`** — `POST /api/ingest` (multipart). Wzór na nowy endpoint `recategorize`.
  Błędy: rzucaj `BadRequestException` / `UnprocessableEntityException` z `domain/Errors.kt`,
  `GlobalExceptionHandler` zmapuje je na 400/422.
- **Front**: React 19 + TS + Zustand 5 + Tailwind 4 (Vite, vitest). Wzorzec sekcji **Collapsible**
  jak Cele/Kredyty — odtwórz go dla kategorii/reguł.

Migracje Flyway: istnieją **V1, V2, V3** → następna to **V4**. Schema = `finance`.

## Schema (Flyway V4)

```sql
create table finance.categories (
    id          bigint generated always as identity primary key,
    name        text not null,
    kind        text not null check (kind in ('variable','fixed','recurring')),
    parent_id   bigint references finance.categories(id),
    created_at  timestamptz not null default now()
);

create table finance.category_rules (
    id          bigint generated always as identity primary key,
    match_field text not null check (match_field in ('description','counterparty')),
    match_type  text not null check (match_type in ('contains','regex')),
    pattern     text not null,
    category_id bigint not null references finance.categories(id),
    priority    int  not null default 100,        -- niższa = wcześniej; pierwsze trafienie wygrywa
    source      text not null default 'manual',   -- 'manual' | 'seed' | 'llm'
    created_at  timestamptz not null default now()
);
create index idx_category_rules_priority on finance.category_rules (priority);

-- transactions.category_id już istnieje (V3); dołóż tylko FK:
alter table finance.transactions
    add constraint fk_transactions_category
    foreign key (category_id) references finance.categories(id);
```

Transakcja działa bez kategorii (`category_id` NULL) — nic jej nie blokuje.

## Zadania

- [ ] **9.1 Flyway V4**: `categories` + `category_rules` + FK `transactions.category_id`.
  Test repo/migracji na Testcontainers (wzór: `TransactionUpsertRepositoryTest`).
- [ ] **9.2 Silnik reguł**:
  - Czysta funkcja/serwis `RuleEngine`: dla `(description, counterparty)` zwraca pierwszą regułę
    wg rosnącego `priority`. `contains` = lowercase substring; `regex` = `Regex`, **łap wyjątek
    przy błędnym wzorcu** i pomiń regułę. **Pokryj unit testami bez bazy** (wzór: `MoneyParserTest`,
    `IngestServiceTest` z mockk).
  - Wpięcie przy ingest: po `insertIgnoreDuplicate` ustaw `category_id` dla świeżo wstawionych wierszy.
    Zalecane proste i idempotentne: `UPDATE finance.transactions SET category_id = :cat
    WHERE id = :id AND category_id IS NULL`.
  - `POST /api/recategorize` (opcjonalnie body `{accountId?}`) — przelicza reguły na istniejących
    transakcjach. **Idempotentny**: ponowne wywołanie daje ten sam wynik. Zwraca `{categorized, total}`.
- [ ] **9.3 Seed reguł** z realnych danych (top kontrahenci po imporcie EPIC 8):
  Biedronka/Żabka/Lidl/ZUS/US/Netia + abonamenty. `source='seed'`. Top wyznacz zapytaniem
  `select counterparty, count(*) ... group by ... order by count desc` na realnych transakcjach.
- [ ] **9.4 LLM fallback** batchem **TYLKO** na `category_id IS NULL`:
  - Przez istniejący homelab tooling (batch), nie syncem per-transakcja.
  - Werdykt → zapis jako **nowa reguła** (`source='llm'`, zwykle `match_type='contains'` na
    znormalizowanym counterparty) → kolejny ingest łapie ją regułami; LLM odpala się coraz rzadziej.
  - Deduplikuj reguły (nie twórz duplikatu istniejącego `match_field+match_type+pattern`).
- [ ] **9.5 Front** (React/Zustand): zarządzanie kategoriami i regułami (Collapsible jak Cele/Kredyty),
  CRUD, oraz **ręczny override kategorii** na pojedynczej transakcji. Override NIE może być
  nadpisywany przez rekategoryzację (rozważ flagę `category_locked boolean` na transakcji,
  albo regułę per-transakcja o najwyższym priorytecie).

## Definition of Done

- ≥ **80%** transakcji skategoryzowane regułami po imporcie.
- LLM rusza tylko na resztę; jego werdykt materializuje się jako reguła.
- Rekategoryzacja **idempotentna**.
- Ręczny override nie znika po rekategoryzacji.

## Wzorzec / pułapki

- **Spójrz na silnik reguł Firefly III** zanim napiszesz własny — sprawdzony model
  `match_field/match_type/priority/first-match`.
- Regex z UI bywa błędny → waliduj przy zapisie reguły i łap wyjątek przy matchowaniu.
- Normalizuj counterparty/description tak samo jak `normalizeDescription` przy fingerprincie w EPIC 8
  (`trim` → collapse spacji → lowercase), żeby reguły `contains` trafiały stabilnie.
- Precedencja: **override użytkownika > reguły > LLM**. Ustal ją jawnie, inaczej rekategoryzacja
  zadepcze ręczne decyzje.

## Zależności, branch, konwencje

- **Zależy od**: EPIC 8 (transakcje). Karmi EPIC 10/11/12 — tam potrzebne `kind` kategorii
  (fixed/recurring vs variable).
- **Branch**: `feat/epic-9-categorization` (od `main` PO zmergowaniu EPIC 8).
- **Dwa remoty**: pushuj na `origin` (GitHub) **i** `forgejo` (192.168.100.165:3000/jakub).
- **Merge do `main` = produkcyjny deploy** na savings.lan (CD z EPIC 5, CT111). Po zakończeniu:
  lint/build/test zielone (front + backend), PR otwarty, **bez auto-merge** bez zgody właściciela.
- Backend: Kotlin + Spring Boot, monorepo `backend/`, Flyway, Testcontainers, CT109 db-finance PG17.
  Kod dydaktyczny (nauka Kotlina) — czytelność > spryt; zachowaj styl komentarzy „INTERVIEW Q".
- Testy: unit bez bazy dla czystej logiki; Testcontainers dla repo/controllerów (pomijane bez Dockera).
- Front: Zustand slice + persist (tryb local) / API (feature flag `VITE_BACKEND`), typy lustrzane do backendu.
