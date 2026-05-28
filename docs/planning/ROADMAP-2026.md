# Savings Planner — plan działania (2026-05-28)

Dokument planistyczny: migracja arkusza `Finanse - YYYY` do aplikacji, backend w Kotlinie, self-host na Proxmox z Forgejo, oraz backlog delegowalnych chunków dla Claude Code / Codex.

> **Status decyzji:** wszystkie kluczowe wybory ZATWIERDZONE (sekcja „Decyzje zatwierdzone"). Plan jest gotowy do egzekucji.

---

## Decyzje zatwierdzone (2026-05-28)

| # | Decyzja | Wybór |
|---|---|---|
| A | Sheets: import vs aplikacja | **Pełna migracja do aplikacji** + jednorazowy importer CSV. Sheets → backup/archiwum. |
| B-stack | Backend | **Kotlin + Spring Boot 3** (cel: nauka Kotlina + CV; reużycie wiedzy o Springu). Kod komentowany dydaktycznie. |
| B-db | Baza | **Dedykowany CT Postgres**, storage z puli **NATEC 1TB**. Osobno od brain-db. |
| C | „Życie w jednym miejscu" | „Jedno miejsce" = warstwa indeksu (brain-memory markdown), NIE jedna fizyczna baza. Finanse fizycznie izolowane. |
| D | Importer | **Kotlin** (silnik parsujący w backendzie), self-explained dydaktycznie. |
| Git/CI | Forge + CI/CD | **Forgejo self-hosted od razu** + lokalny Actions runner. Finanse nie opuszczają homelaba. |
| 1 | Migracja plików Sheets | Tak, jako backup. |
| 4 | Multi-tenancy | **Single-tenant** (tylko Ty). |
| 5 | Krypto | Manualnie; **wyszedłeś z krypto** → konta Coinbase/Crypto.com/Ledger dostają `closed_at`. |
| E | Sheets live ingestor | **Wywalony** z roadmapy. |

### Zakres historyczny (kluczowe dla scope)
- **Stany kont (assets):** pełna historia od **2022-05 do teraz** (osobne CSV per rok: 2022–2026). Potrzebne do analiz długoterminowych (CAGR, save rate, projekcja FIRE).
- **Długi / raty / abonamenty / nadchodzące wydatki:** TYLKO aktualny stan. Bez historii, bez tabel snapshot.

---

## 1. Baseline (co już jest)

Repo `E:\repo\savings-planner`: Vite + React 19 + TS + Tailwind 4 + Zustand 5 (persist → localStorage) + Recharts 3 + Vitest.

- `src/domain/types.ts`: `Goal`, `Loan`, `MortgagePlan` (refinansowanie, nadpłaty, 2 tryby), `Settings`, `Overrides`, `Schedule`.
- `src/domain/allocation.ts`: silnik harmonogramu (kredyty → stałe alokacje → wg pilności).
- `src/domain/mortgage.ts`: pełny harmonogram amortyzacyjny (+ testy).
- UI: Hero, GoalList (drag&drop), LoanList, MortgageSection, ScheduleTable (edytowalna), SavingsChart, WhatIfSlider, AdvancedSettings (import/export JSON).

**Czego brak:** stanów kont (assets) i ich historii, abonamentów, jednorazowych nadchodzących wydatków, backendu, hostingu, CI/CD, PWA.

**Dług techniczny:** zmiany mortgage z 2026-05-24 (zaakceptowane wg memory) są w working tree, ale **niezacommitowane** — patrz chunk `0.0`.

---

## 2. Analiza szablonu `Finanse - YYYY`

6 logicznych sekcji arkusza (wyciągnięte z PDF roku 2024):

| Sekcja | Zawartość | Mapping w apce | Historia? |
|---|---|---|---|
| §2.1 Stany kont (tabela miesięczna) | wiersze=miesiąc `<MiesiącPL> (DD.MM)`, kolumny=konta (Alior, Mbank, Obligacje, Revolut, krypto, IKZE, konta mieszkaniowe…) | **`Account` + `AccountSnapshot`** (nowe) | **TAK, 2022-05→teraz** |
| §2.2 Długi (Garmin, Alior) | saldo + rata | `Loan` (istnieje) | nie, tylko aktualne |
| §2.3 Abonamenty (~13 poz., ~876 zł/mc) | nazwa + kwota | **`Subscription`** (nowe) | nie |
| §2.4 Nadchodzące koszty (one-shot) | nazwa + miesiąc + kwota (np. Wakacje/Lipiec 5650 zł) | **`UpcomingExpense`** (nowe) | nie |
| §2.5 Cele (Mieszkanie 300k, FIRE 2M) | kwota + deadline + tempo | `Goal` (istnieje) | nie |
| §2.6 % udział środków | pie chart | derived z latest snapshot | n/d |

**Kluczowa zmiana modelu:** rozdział **assets (snapshoty kont w czasie)** vs **cashflow (income/expense/goals/loans)**. Dziś apka to tylko cashflow; arkusz to głównie assets. Łączymy oba.

### Account lifecycle
Przez 4 lata konta były otwierane i zamykane (np. „Santander Mieszkanie" start 2024-04; krypto zamknięte po wyjściu). Model:
- `opened_at` = data pierwszego snapshota (auto z importera).
- `closed_at` = `null` dla aktywnych; data dla zamkniętych.
- Render w tabeli tylko w `[opened_at, closed_at]`; toggle „pokaż zamknięte".
- Net worth chart: po `closed_at` balance = 0 (nie luka — suma majątku się nie fałszuje), historia zostaje.

---

## 3. Architektura docelowa

```
┌─────────────────────────────────────── Proxmox (Optiplex 3080, 192.168.100.150) ───────────────┐
│                                                                                                  │
│  CT (app)            CT (db-finance)        CT (forgejo)         istniejące:                      │
│  savings-planner     Postgres 16            Forgejo + runner     CT103 nginx-proxy (LAN)          │
│  ┌───────────────┐   ┌────────────────┐     ┌───────────────┐    CT101 AdGuard (DNS)             │
│  │ React (Vite)  │   │ schema finance │     │ git + Actions │    CT105 brain-db (OSOBNO)          │
│  │ + nginx       │   │ Flyway         │     │ local runner  │                                     │
│  │ Kotlin/Spring │◄──┤ vol z NATEC 1TB│     └──────┬────────┘                                     │
│  │ Boot API      │   └────────────────┘            │ push main → build+test+deploy               │
│  └───────┬───────┘                                 │ (runner widzi LAN, bez Tailscale)           │
│          │ nginx-proxy → savings.lan               ▼                                              │
└──────────┼──────────────────────────────── deploy: docker compose pull && up ───────────────────┘
           │
     LAN / (opcjonalnie) Cloudflare Access → Fold 4
```

- **Storage:** NATEC 1TB = współdzielona pula Proxmox (finanse biorą mały volume; reszta puli dla innych projektów, m.in. saves-pipeline media). ⚠️ **Reconcile** z `STATE/homelab.md` (NATEC wcześniej zaklepany pod media-vol — teraz pula współdzielona).
- **Baza finansowa osobno od brain-db** (izolacja krytyczności/backupu/ekspozycji — uzasadnienie w sekcji „Decyzje").
- **VMID/IP:** sugerowane CT od `108`/`.163` w górę; dokładne numery do ustalenia przy zakładaniu (kolizja z planowanym CT108 media-worker z saves-pipeline — wybrać wolne).

### Stack backendu (zatwierdzony, dydaktyczny)
- **Język:** Kotlin (JVM 21).
- **Framework:** Spring Boot 3 (Spring Web, Spring Data JPA, Validation).
- **Build:** Gradle Kotlin DSL (`build.gradle.kts`).
- **Migracje:** Flyway (SQL w `db/migration`).
- **DB:** Postgres 16, driver + HikariCP (domyślny w Spring Boot).
- **Docs:** springdoc-openapi (Swagger UI).
- **Testy:** JUnit 5 + Spring Boot Test + MockK + Testcontainers (Postgres) dla testów repo.
- **Importer CSV:** moduł Kotlin (np. Apache Commons CSV lub kotlin-csv), silnik parsujący wystawiony jako endpoint + reużywalny w teście.

### Zasady nauki Kotlina (obowiązują KAŻDY backendowy chunk)
Każdy delegowany agent pracujący nad backendem MUSI:
1. Komentować nieoczywiste konstrukcje Kotlina dydaktycznie (data class, sealed class, `?`/`?:`/`let`/`also`, extension functions, `when`, scope functions, coroutines jeśli użyte, DSL Springa w Kotlinie).
2. Preferować idiomatyczny Kotlin (immutability, `val`, null-safety, brak `!!` bez uzasadnienia).
3. W opisie PR dodać krótką sekcję „Czego się tu uczysz" (3-5 punktów: jakie idiomy Kotlina/Spring użyto i dlaczego).
4. Tłumaczyć mapowania Spring (adnotacje `@Entity`, `@RestController`, `@Service`, DI przez konstruktor) z porównaniem do Javy, którą Jakub już zna.

---

## 4. Model danych (schema `finance`, Flyway V1)

```sql
create schema finance;

create table finance.accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  bucket      text not null,         -- 'cash' | 'investment' | 'retirement' | 'down_payment' | 'crypto'
  currency    text not null default 'PLN',
  opened_at   date,                  -- pierwszy snapshot (auto z importera)
  closed_at   date,                  -- null = aktywne; data = zamknięte
  created_at  timestamptz not null default now()
);

create table finance.account_snapshots (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references finance.accounts(id) on delete cascade,
  snapshot_date date not null,
  balance       numeric(14,2) not null,
  notes         text,
  unique (account_id, snapshot_date)
);
create index on finance.account_snapshots (snapshot_date);

-- poniższe: TYLKO aktualny stan, bez historii
create table finance.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  remaining_balance numeric(14,2) not null,
  monthly_payment numeric(14,2) not null,
  kind text not null default 'installment'   -- 'installment' | 'mortgage'
);

create table finance.subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_amount numeric(10,2) not null,
  active boolean not null default true,
  next_charge date,
  category text
);

create table finance.upcoming_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null,
  target_month date not null,        -- pierwszy dzień miesiąca realizacji
  is_paid boolean not null default false
);

create table finance.goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_amount numeric(14,2) not null,
  deadline date,
  priority int not null,
  fixed_allocation numeric(12,2),
  current_saved numeric(14,2) default 0
);

create table finance.mortgage_plans (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null             -- struktura MortgagePlan 1:1 (najprościej)
);
```

Buckety derived KPI: `Suma majątku` = Σ aktywnych kont; `Fundusz awaryjny` = Σ bucket∈{cash,investment}; `Wkład własny` = Σ bucket=down_payment. Mapowanie bucketów konfigurowalne w UI.

---

## 5. Importer CSV (multi-year, Kotlin)

Jednorazowy bootstrap historii: po jednym pliku rocznie (`2022.csv` … `2026.csv`).

Algorytm (silnik w Kotlinie):
1. Wczytaj plik → wykryj rok (nazwa pliku lub `A1`) i nagłówki kont.
2. Mapping kolumna → konto: `istniejące | nowe | pomiń (derived)`. Mapping **persystowany** (kolejne lata pre-fill).
3. Parser daty `<MiesiącPL> (DD.MM)` + rok → `snapshot_date`.
4. Upsert snapshotów po `(account_id, snapshot_date)`. `opened_at` = min(date).
5. Lifecycle: konto z ciszą ≥3 mies. w nowszych latach → propozycja `closed_at`.

Skala: ~60 miesięcy × ~10 kont ≈ 600 snapshotów. Trywialne dla Postgres i localStorage.

Flow: React (upload + UI mapowania, preview 5 wierszy) → `POST /api/import/account-snapshots` (CSV + mapping JSON) → silnik Kotlin parsuje, waliduje, persystuje. Ten sam silnik testowany jednostkowo na fixture'ach CSV.

---

## 6. Backlog — delegowalne chunki

Konwencja: każdy chunk = jeden PR-sized task dla Claude Code/Codex. Format: **ID · tytuł · zależy od · zakres · acceptance · seed promptu**. Epiki uporządkowane wg zależności; w obrębie epiku chunki sekwencyjne chyba że zaznaczono „równolegle".

> Egzekucja: EPIC 0 (infra) i EPIC 1 (frontend assets) mogą iść **równolegle** — różne obszary. Backend (EPIC 3) zależy od EPIC 0. Integracja (EPIC 4) zależy od 1+3.

### EPIC 0 — Infra / homelab (runbooki + skrypty)

**0.0 · Commit zaległych zmian mortgage** · zależy: — · *Zakres:* zacommitować istniejące, zaakceptowane (2026-05-24) zmiany mortgage w working tree osobnym commitem przed startem nowej pracy. *Acceptance:* `git status` czysty, `npm test` zielony (15 testów). *Seed:* „Working tree savings-planner ma niezacommitowane zaakceptowane zmiany mortgage. Zweryfikuj testami i zacommituj jako `feat(mortgage): payoff planner (accepted 2026-05-24)`."

**0.1 · NATEC jako pula storage Proxmox** · zależy: — · *Zakres:* sformatować NATEC 1TB, dodać jako storage Proxmox (LVM-thin lub directory), zarezerwować mały volume pod CT db-finance. Zaktualizować `STATE/homelab.md` (NATEC = pula współdzielona, nie media-only). *Acceptance:* storage widoczny w Proxmox, runbook w `docs/ops/`. *Uwaga:* manualny task ops — agent pisze runbook, Jakub wykonuje.

**0.2 · CT Postgres db-finance** · zależy: 0.1 · *Zakres:* CT Debian + Postgres 16, baza `finance`, user app-only, volume z NATEC, pg_dump cron + retencja. Runbook + skrypt init. *Acceptance:* `psql` z CT app działa; backup cron testowo odpalony.

**0.3 · CT Forgejo + Actions runner** · zależy: — · *Zakres:* CT z Forgejo (docker compose), lokalny Actions runner zarejestrowany, repo `savings-planner` zmigrowane/zmirrorowane. Runbook. *Acceptance:* push do Forgejo triggeruje przykładowy workflow „hello" na runnerze.

**0.4 · CT app + reverse proxy + DNS** · zależy: 0.1 · *Zakres:* CT app (docker + compose), wpis w nginx-proxy (CT103) `savings.lan`, rekord w AdGuard (CT101). *Acceptance:* `http://savings.lan` serwuje placeholder.

### EPIC 1 — Assets we frontendzie (local-only, szybka wartość)

**1.1 · Typy + slice Account/AccountSnapshot** · zależy: — · *Zakres:* `Account` (z opened_at/closed_at/bucket), `AccountSnapshot` w `types.ts`; Zustand slice + akcje CRUD + persist; export/import JSON rozszerzony. *Acceptance:* testy slice'a; lint/build zielone.

**1.2 · UI: tabela stanów kont** · zależy: 1.1 · *Zakres:* zakładka „Stany kont": tabela wiersze=miesiąc, kolumny=konto, inline edit komórek; CRUD kont; toggle „pokaż zamknięte"; dodawanie kolumn na żywo. *Acceptance:* można odtworzyć układ z arkusza ręcznie; lifecycle respektowany.

**1.3 · Buckety + 3 KPI** · zależy: 1.1 · *Zakres:* konfiguracja przypisania kont→bucket; karty KPI (Suma majątku, Fundusz awaryjny, Wkład własny) z latest snapshot. *Acceptance:* KPI zgodne z ręcznym sumowaniem.

**1.4 · Net worth chart** · zależy: 1.1, (2.x dla długów opcjonalnie) · *Zakres:* Recharts: linia majątku w czasie (Σ snapshotów − długi), closed accounts → 0 po `closed_at`. *Acceptance:* wykres pokrywa się z danymi tabeli.

**1.5 · Pie chart % udziału** · zależy: 1.3 · *Zakres:* pie udziału bucketów/kont na ostatni snapshot. *Acceptance:* sumuje się do 100%.

### EPIC 2 — Abonamenty + nadchodzące wydatki (frontend, aktualne)

**2.1 · Typy + slice Subscription/UpcomingExpense** · zależy: — · *Zakres:* typy + Zustand + CRUD + persist + export/import. *Acceptance:* testy slice'a.

**2.2 · UI listy CRUD** · zależy: 2.1 · *Zakres:* sekcje „Abonamenty" i „Nadchodzące wydatki" (Collapsible jak istniejące). *Acceptance:* dodawanie/edycja/usuwanie działa.

**2.3 · Wpięcie w cashflow** · zależy: 2.2 · *Zakres:* suma abonamentów → składnik `monthlyExpenses` (osobna linia w Hero, bez double-counting); one-shoty → `MonthRow.expenses` danego miesiąca; markery na SavingsChart. *Acceptance:* harmonogram i wykres uwzględniają nowe koszty.

### EPIC 3 — Backend Kotlin/Spring Boot (zależy: EPIC 0)

**3.1 · Scaffold backendu** · zależy: 0.2 · *Zakres:* projekt Gradle KTS, Spring Boot 3, Kotlin, Postgres, Flyway, springdoc, profile (local/prod), Dockerfile, healthcheck. Kod komentowany dydaktycznie + README „od zera w Kotlinie". *Acceptance:* `./gradlew bootRun` startuje, `/actuator/health` = UP, Swagger UI dostępny.

**3.2 · Schema + encje + repozytoria** · zależy: 3.1 · *Zakres:* Flyway V1 (sekcja 4), encje JPA (data class + `@Entity`), `JpaRepository` per tabela; Testcontainers test repo. *Acceptance:* migracja przechodzi; testy repo zielone.

**3.3 · REST API CRUD** · zależy: 3.2 · *Zakres:* kontrolery + serwisy + DTO + walidacja dla accounts, snapshots (CRUD + `GET /accounts/{id}/history`), debts, subscriptions, upcoming-expenses, goals, mortgage. OpenAPI opisane. *Acceptance:* testy MockMvc/WebTestClient na happy + walidacja.

**3.4 · Silnik importera CSV** · zależy: 3.2 · *Zakres:* parser multi-year (sekcja 5) jako serwis Kotlin + `POST /api/import/account-snapshots`; sealed class na wynik mapowania; testy na fixture'ach CSV (2022–2026 sample). *Acceptance:* import sample tworzy konta + snapshoty + wykrywa lifecycle.

**3.5 · Hardening** · zależy: 3.3, 3.4 · *Zakres:* obsługa błędów (`@ControllerAdvice`), logowanie, CORS dla frontu, prosta auth (single-tenant: token/basic), seed/dev fixtures. *Acceptance:* błędy zwracają sensowny JSON; nieautoryzowany = 401.

### EPIC 4 — Integracja front ↔ backend (zależy: 1, 2, 3)

**4.1 · Warstwa API client + feature flag** · zależy: 3.3 · *Zakres:* klient HTTP w froncie, flaga `VITE_BACKEND=local|api`; przy `local` zachowanie bez zmian. *Acceptance:* przełącznik nie psuje trybu local.

**4.2 · Sync localStorage → backend (bootstrap)** · zależy: 4.1 · *Zakres:* przycisk „Wyślij dane do bazy"; idempotentny upsert; UI importu CSV podłączone do `3.4`. *Acceptance:* dane z przeglądarki + CSV lądują w Postgres; ponowny sync nie duplikuje.

**4.3 · Backend jako source of truth** · zależy: 4.2 · *Zakres:* odczyty z API (accounts/snapshots/cele/długi/mortgage), Zustand jako cache + optimistic update. *Acceptance:* odświeżenie ładuje z bazy; offline degraduje do cache.

### EPIC 5 — CI/CD + deploy (Forgejo) (zależy: 0.3, 0.4)

**5.1 · Workflow build+test** · zależy: 0.3 · *Zakres:* Forgejo Actions: backend `./gradlew test build`, frontend `npm ci && npm test && npm run build`. *Acceptance:* push do main = zielony pipeline.

**5.2 · Dockeryzacja + compose** · zależy: 5.1, 0.4 · *Zakres:* obrazy backend (JVM) + frontend (nginx static), `docker-compose.yml` na CT app (app + sieć do db-finance). *Acceptance:* `docker compose up` lokalnie i na CT app działa.

**5.3 · Auto-deploy przez runner** · zależy: 5.2 · *Zakres:* job deploy na lokalnym runnerze: build → push do registry Forgejo → `compose pull && up -d` na CT app; rollback po tagu. *Acceptance:* merge do main → apka zaktualizowana bez ręcznej roboty.

### EPIC 6 — PWA + mobile

**6.1 · PWA** · zależy: 4.3 · *Zakres:* `vite-plugin-pwa`, manifest, ikony, offline shell. *Acceptance:* instalowalne na Fold 4; działa offline (cache).

**6.2 · Dostęp z zewnątrz (opcjonalne)** · zależy: 5.3, 6.1 · *Zakres:* Cloudflare Tunnel route `savings.jakubmikolajczyk.com` + Cloudflare Access (whitelist kupciu1@gmail.com). *Acceptance:* dostęp z telefonu poza domem za auth.

### EPIC 7 — Inteligencja danych (po MVP)

- **7.1** Real CAGR per bucket z historii snapshotów.
- **7.2** Save rate vs target (% income → assets, miesięcznie).
- **7.3** Projekcja FIRE przy real CAGR + scenariusze (Monte Carlo 8/10/12%).
- **7.4** Alerty (fundusz awaryjny < 6×wydatki; abonament za 3 dni; deadline celu blisko).
- **7.5** Integracja Todoist (cel/wydatek zbliża się → task przez MCP).
- **7.6** Eksport raportu rocznego PDF.
- **7.7** Import wyciągów bankowych (mBank/Alior CSV) + kategoryzacja — duże, kandydat na osobny projekt.

---

## 7. Kolejność egzekucji (sugerowana)

1. **Fala 1 (równolegle):** EPIC 0 (0.0→0.1→0.2/0.3/0.4) ∥ EPIC 1 ∥ EPIC 2. → arkusz w pełni odtworzony w przeglądarce + infra gotowa.
2. **Fala 2:** EPIC 3 (backend) → EPIC 4 (integracja). → dane w Postgres, apka czyta z bazy.
3. **Fala 3:** EPIC 5 (CI/CD) → EPIC 6 (PWA + dostęp z telefonu).
4. **Fala 4:** EPIC 7 (analizy) iteracyjnie.

Pierwszy konkretny krok do delegacji: **0.0** (commit mortgage) + **1.1** (typy Account) — odblokowują resztę i nie zależą od infry.

---

## 8. Referencje

- Repo: `E:\repo\savings-planner` · Memory: `E:\repo\brain-memory\PROJECTS\savings-planner.md`
- Homelab: `E:\repo\brain-memory\STATE\homelab.md` (⚠️ reconcile NATEC) · Sprzęt: `STATE\devices.md`
- Szablon źródłowy: `Finanse - YYYY` (2022–2026), PDF 2024 jako sample
- brain-db (OSOBNO): CT105 / 192.168.100.162 · nginx-proxy: CT103 · AdGuard: CT101 · Cloudflare: jakubmikolajczyk.com
