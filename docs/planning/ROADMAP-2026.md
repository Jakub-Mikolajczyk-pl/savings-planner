# Savings Planner — analiza i roadmapa (2026-05-28)

Dokument planistyczny zbierający odpowiedzi na otwarte pytania o kierunek rozwoju aplikacji: integracja z istniejącym arkuszem `Finanse - 2024.xlsx`, decyzja o backendzie i bazie danych, hosting na homelabie (Proxmox/LXC), CI/CD i lista funkcji do dołożenia.

---

## 0. Co dziś mamy (baseline)

**Repo:** `E:\repo\savings-planner`, Vite + React 19 + TS + Tailwind 4 + Zustand 5 (persist → localStorage) + Recharts 3 + Vitest.

**Domeny (`src/domain/`):**
- `types.ts`: `Goal`, `Loan`, `MortgagePlan` (z refinansowaniem, nadpłatami, dwoma trybami), `Settings`, `Overrides`, `Schedule`, `MonthRow`, `GoalProgress`, `LoanProgress`.
- `allocation.ts`: silnik harmonogramu — kredyty pierwsze, potem stałe alokacje, potem proporcjonalnie wg pilności (deadline × pozostała kwota).
- `mortgage.ts`: pełny amortyzacyjny harmonogram (z testami, base payment z `originalTermMonths`).

**UI:** Hero (income/expense), GoalList (drag&drop), LoanList, MortgageSection, ScheduleTable (edytowalna), SavingsChart, WhatIfSlider, AdvancedSettings (import/export JSON).

**Czego nie ma:** stanów kont, historii rzeczywistej (snapshoty), abonamentów jako osobnej kategorii, jednorazowych nadchodzących wydatków, walut/krypto, backendu, hostingu, CI/CD, multi-user, mobile.

---

## 1. Analiza szablonu `Finanse - 2024` (PDF/Google Sheets)

Z PDF wyciągnąłem strukturę arkusza. Ma 6 logicznych sekcji:

### Zakres historyczny (ważne dla scope migracji)

- **Stany kont:** chcemy **całą historię od maja 2022 do teraz** (2022, 2023, 2024, 2025, 2026 — osobne arkusze/CSV). Statystyki i analizy długoterminowe (real CAGR, save rate, projekcja FIRE) wymagają długiego szeregu.
- **Długi / raty / abonamenty / nadchodzące wydatki:** TYLKO aktualny snapshot. Historia nieistotna — wpisujemy stan na dziś i jedziemy do przodu.

### 1.1. Stany kont — tabela miesięczna (kręgosłup arkusza)

Wiersze = miesiące (`Styczeń (16.01)`, `Luty (13.02)`, ...). Kolumny = konta:

| Kolumna | Typ | Uwaga |
|---|---|---|
| Alior | konto bankowe PLN | |
| Mbank | konto bankowe PLN | |
| Obligacje | inwestycja | |
| Revolut | konto walutowe | |
| Coinbase | krypto | przeliczenie do PLN |
| Crypto.com | krypto | |
| Ledger (oszczędności) | cold wallet | |
| Alior IKZE | emerytalne | |
| Mieszkanie Mbank | escrow / wpłaty na mieszkanie | |
| Santander Mieszkanie | jw. | |

**Kolumny wyliczane (derived):**
- `Suma majątku` = suma wszystkich kont
- `Fundusz Awaryjny` (Obligacje + Oszczędności) — bucket
- `Wkład własny Mieszkanie` — kolejny bucket
- `Suma dług` — z osobnej sekcji długów

**Obserwacja:** arkusz pokazuje **stan kont na konkretny dzień** (data w nawiasie obok miesiąca). To nie jest cashflow — to net-worth snapshot. Aplikacja dziś tego nie modeluje wcale.

### 1.2. Długi (Garmin 2,575.30 zł, Alior 1,709.80 zł)

Mapują się 1:1 do obecnego `Loan` (jest `remainingBalance` + `monthlyPayment`). W arkuszu są tylko sumaryczne — `Suma rat miesięcznie` i `Suma długów`.

### 1.3. Abonamenty (13 pozycji, ~876 zł/mc)

Nju, Orange, GPT, Netflix, Spotify, Youtube Premium, Google One, Revolut Premium, Patronite, Disney+, Dhosting, Sekcja (powerlifting?). Każdy z kwotą. **Suma = składnik `monthlyExpenses`**, dziś jednak wpisywany jako jedna liczba.

### 1.4. Nadchodzące koszty (one-shot, z miesiącem realizacji)

`Wyjazd rocznicowy (Marzec) - 5 000 zł`, `Święta wielkanocne - 500 zł`, `Wakacje (Lipiec) - 5 650 zł`, `Wyjazd do Ameryki (Październik) - 10 000 zł`, `Badania sportowe`, `Szyna relaksacyjna - 900 zł`, `Badanie EMG - 800 zł`, …

**To nie są cele.** To jednorazowe wydatki przypisane do konkretnego miesiąca — wpływają na `freeCash` w tym jednym miesiącu. Dziś modelowane jako `MonthOverride.expenses` (override sumaryczny), ale tracimy etykietę i strukturę.

### 1.5. Cele długoterminowe

- `Cel mieszkanie`: 300 000 zł, deadline 2025-02-01, ~10 000 zł/mc.
- `Cel FIRE`: 2 000 000 zł, rok 2044 (lub 20 lat po zakupie), 9 000 zł/mc.

Te 1:1 mapują się do `Goal` (już są w apce).

### 1.6. Wykresy / udziały (% udział środków w sumie majątku)

Derived view — pie chart kont. Trywialny do dorobienia jak będzie sekcja 1.1.

---

## 2. Pytanie A — Google Sheets: czy aplikacja czyta szablon, czy przenosimy się do aplikacji?

**Rekomendacja: pełna migracja do aplikacji + jednorazowy CSV import jako bootstrap.**

### Dlaczego nie „aplikacja czyta dowolny szablon"
- Szablon jest **niestrukturalny i organicznie zmieniany** (kolumny dochodzą/odchodzą, daty w nawiasie obok miesiąca, sekcje boczne porozrzucane). Mapping wymagałby albo bardzo sztywnego kontraktu, albo LLM-mappera.
- Każda zmiana w arkuszu (dodanie konta, zmiana nazwy) wybije parser. Sprzężenie zwrotne psucia jest ciężkie.
- Sheets jako źródło prawdy oznacza, że nadal robisz robotę ręcznie w arkuszu — a aplikacja jest tylko widokiem. Wtedy traci sens.
- Aplikacja już ma model danych (`types.ts`), który lepiej narzuca strukturę.

### Dlaczego pełna migracja
- Stany kont, długi, abonamenty, nadchodzące wydatki, cele — wszystko da się ułożyć w czyste typy (sekcja 5).
- Aplikacja dostaje pełną „prawdę" → możesz na niej liczyć ROI kont, real growth rate, wykres % udziału, alerty.
- Wszystko wraca: szablon Sheets stoi się **archiwum historycznym**, a aplikacja jest nowym frontem.

### Co wziąć z Sheets jednorazowo
Jeden **CSV importer** (sekcja stany kont) + 30 min ręcznego klikania (abonamenty, długi, cele). Realny koszt migracji: 1–2h.

### Wariant „middle ground" jeśli jednak chcesz Sheets jako live source
Tylko sekcja 1.1 (stany kont) — bo tylko ona jest regularnie wprowadzana. Wtedy:
- Google Sheets API z service-account + share read-only do tego konta.
- Sztywny kontrakt: pierwsza kolumna = miesiąc, kolejne = konta (nagłówki = nazwy), pomijasz puste komórki.
- Aplikacja okresowo (co dzień) pobiera arkusz i zapisuje snapshoty.

Ten wariant odradzam — narzuca sztywność szablonowi, a i tak nie ogarnia długów/abonamentów/wydatków bocznych.

---

## 3. Pytanie B — Baza danych i backend?

**Rekomendacja: TAK, ale incrementalnie. Postgres na istniejącym `brain-db` (CT105). Backend FastAPI lub Node/Express.**

### Argumenty za bazą
1. **Historia stanów kont** to time-series — `localStorage` w pojedynczej zakładce przeglądarki to za mało (sync między urządzeniami, telefon, backup).
2. Już masz `brain-db` (Postgres + pgvector) na `192.168.100.162` — incremental cost = nowa schema, zero infry do postawienia.
3. Long-term: cele typu FIRE są na 20 lat — chcesz przeżyć formatowanie laptopa.
4. Możliwość liczenia rzeczy, których w przeglądarce ciężko: real CAGR per konto, korelacja stanów (np. spadek krypto vs wzrost lokat), miesięczne save-rate vs target.

### Argumenty „nie teraz"
- MVP w przeglądarce już działa i jest bezpieczny (no telemetria).
- Dodanie backendu = auth, deploy, monitoring → wzrost złożoności.

### Kompromis (rekomendowany ścieżka):

**Faza 1 (1–2 dni):** Postgres schema + cienki backend (FastAPI lub Node), endpoint `POST /snapshot` (stany kont w danym dniu), `GET /history`. UI: nowa zakładka „Stany kont" (sekcja 5). Reszta apki dalej w `localStorage`, ale z guzikiem „Sync to brain-db".

**Faza 2:** Migracja `goals/loans/mortgagePlan/overrides` do bazy. Zustand zostaje jako cache + optimistic update. Backend = source of truth.

**Faza 3 (opcjonalnie):** Auth (single-user JWT) — dziś LAN + Cloudflare Tunnel, ale jak chcesz dostęp z telefonu publicznie, musisz to zamknąć.

### Schema (propozycja, sekcja 5 ma pełniejszy mapping)

```sql
create schema finance;

create table finance.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bucket text,  -- 'cash' | 'investment' | 'crypto' | 'retirement' | 'down_payment'
  currency text not null default 'PLN',
  opened_at date,                 -- pierwszy snapshot (auto-fill z importera)
  closed_at date,                 -- null = aktywne; data = zamknięte/przeniesione
  created_at timestamptz not null default now()
);

create table finance.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references finance.accounts(id),
  snapshot_date date not null,
  balance numeric(14, 2) not null,
  notes text,
  unique (account_id, snapshot_date)
);

create table finance.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  remaining_balance numeric(14, 2) not null,
  monthly_payment numeric(14, 2) not null,
  kind text not null default 'installment'  -- 'installment' | 'mortgage'
);

create table finance.subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_amount numeric(10, 2) not null,
  active boolean not null default true,
  next_charge date,
  category text
);

create table finance.upcoming_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12, 2) not null,
  target_month date not null,  -- pierwszy dzień miesiąca realizacji
  is_paid boolean not null default false
);

create table finance.goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_amount numeric(14, 2) not null,
  deadline date,
  priority int not null,
  fixed_allocation numeric(12, 2),
  current_saved numeric(14, 2) default 0
);

create table finance.mortgage_plans (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null  -- struktura MortgagePlan 1:1 (najprościej)
);
```

`brain-db` ma już `pgvector` i jest LAN-only — wpasowuje się.

---

## 4. Pytanie C — Self-host na Proxmox + CI/CD

**Rekomendacja: nowy CT (np. CT109 `savings-planner`), Docker Compose, GitHub Actions → SSH deploy. Reverse proxy przez istniejący `nginx-proxy` (CT103). Cloudflare Tunnel TYLKO jeśli chcesz dostęp z telefonu poza domem.**

### Stan wyjściowy (z `STATE/homelab.md`)
- Proxmox `192.168.100.150`, CT-y od 100 wzwyż, wolne IP od `.163`.
- `nginx-proxy` (CT103) = LAN reverse proxy.
- Cloudflare Tunnel działa (`jakubmikolajczyk.com`).
- `brain-db` (CT105) na `.162` z Postgres.
- PC roboczy: Windows, online 16h+/dzień, główny katalog `E:\repo`.

### Wybór: prostsze vs przyszłościowe

| Opcja | Plus | Minus |
|---|---|---|
| **A. GitHub Actions → SCP + systemd** na CT109 | Najprostsze. 1 plik workflow. Action `appleboy/ssh-action`. | Każda nowa apka = nowy ręczny setup CT. |
| **B. Docker Compose + GHCR + Watchtower** na CT109 | Repeatable. Roll back przez tag. | Watchtower ma reputację „lubi się gubić". |
| **C. Coolify lub Dokploy** na osobnym CT | Self-hosted Vercel. Auto-deploy z push do main. Każda kolejna apka (saves pipeline, memory-mcp) idzie tym samym kanałem. | Trochę resourców (1GB RAM dla Coolify). |
| **D. Portainer + GHCR + Stack autoupdate** | Webowy GUI, niezły kontroler stacków. | Mniej zintegrowany z gitem niż Coolify. |

**Sugerowana ścieżka:**
- **Krótkoterminowo (teraz, na MVP):** opcja A. 1 CT, GitHub Actions workflow buduje `dist/`, SCP do `/var/www/savings-planner/`, lub buduje Docker image i robi `docker compose pull && up -d`. Nginx-proxy przekierowuje `savings.lan` → CT109:80.
- **Średnio (jak będziesz miał 2–3 swoje apki):** opcja C, Coolify. Stawiasz na CT110, podpinasz każde repo, push = deploy. To samo dla saves pipeline.

### Workflow GitHub Actions (opcja A, konkretnie)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Deploy via SSH
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.HOMELAB_HOST }}      # publiczny endpoint Cloudflare Tunnel SSH lub Tailscale
          username: deploy
          key: ${{ secrets.DEPLOY_KEY }}
          source: "dist/*"
          target: "/var/www/savings-planner"
          strip_components: 1
```

**Pytanie do rozstrzygnięcia:** jak GitHub Actions dochodzi do CT109? Trzy opcje:
1. **Cloudflare Tunnel + cloudflared SSH** (masz infrę, najczystsze).
2. **Tailscale subnet router** (najprościej, działa od ręki, GH Action ma `tailscale/github-action`).
3. **Self-hosted runner na PC roboczym** — runner widzi LAN bezpośrednio, push z PC dociera do CT. Plus: Docker Desktop już masz. Minus: PC musi być online (jest, 16h/dzień, ale jednak).

**Sugestia:** Tailscale (opcja 2). 10 min setupu, działa z GH Actions out-of-the-box, nie wymaga publicznego eksponowania SSH przez Cloudflare.

### Dostęp z zewnątrz
- Jeśli **tylko LAN/VPN** — wystarczy `nginx-proxy` (CT103) + entry `savings.lan` w AdGuard (CT101). Już to masz w architekturze.
- Jeśli **publicznie** (telefon w pracy) — Cloudflare Tunnel route na `savings.jakubmikolajczyk.com` → CT109. Wymaga auth (basic auth na nginx, albo Cloudflare Access). **Single-user, więc finanse za publiczny endpoint = auth obowiązkowy.**

---

## 5. Pytanie D — Trudność migracji szablonu, mapowanie 1:1

Per sekcja PDF (`§1.1`–`§1.6`):

| Sekcja PDF | Trudność | Mapping w apce | Co dorobić |
|---|---|---|---|
| Stany kont miesięczne (§1.1) | **Łatwa** | `Account` + `AccountSnapshot` (tabela snapshot/miesiąc) | Nowa zakładka „Stany kont"; CRUD kont; importer CSV (pierwszy wiersz = nagłówki kont) |
| Długi (§1.2) | **Trywialna** | `Loan` (już jest) | Nic, używamy istniejącego |
| Abonamenty (§1.3) | **Łatwa** | `Subscription` (nowy typ) | Lista + autoSum do `monthlyExpenses` lub osobna linia w Hero |
| Nadchodzące koszty (§1.4) | **Łatwa** | `UpcomingExpense` (jednorazowy, z `targetMonth`) | Lista; wpływ na `MonthRow.expenses` tego miesiąca; widoczne na chartzie jako pionowe markery |
| Cele długoterminowe (§1.5) | **Trywialna** | `Goal` (już jest) | Nic |
| Pie chart % udziału (§1.6) | **Łatwa** | Derived z `AccountSnapshot` (latest) | Nowy Recharts pie z buckets |

**Kluczowa zmiana modelu:** wprowadzić rozróżnienie **assets (snapshoty kont)** vs **cashflow (income/expense/goals/loans)**. Dziś apka jest tylko cashflow. Sheets jest tylko assets. Spotkajmy się pośrodku.

### Pomysł UX dla §1.1

Tabela z wierszami=miesiąc i kolumnami=konto (taka sama jak w arkuszu — komfort migracji wzrokowej). Każda komórka = inline edit. Kolumny dodawane na żywo. Importer CSV z dialogiem "ta kolumna to konto X, tamtą pomiń". Pod tabelą: 3 derived KPI (Suma majątku, Fundusz awaryjny, Wkład własny) z konfigurowalnymi „bucketami" (które konta wchodzą do którego bucketa).

### Importer CSV (multi-year bootstrap)

Importer jest **wielokrotny** — wczytujesz po kolei `Finanse - 2022.csv`, `2023.csv`, `2024.csv`, `2025.csv`, `2026.csv`. Każdy plik to jeden rok.

Algorytm:
1. Wybór pliku → wyciągnięcie roku z nazwy (lub komórki `A1`) i header kont.
2. UI mapper: każdą kolumnę przypisz do `istniejące konto | nowe konto | pomiń (derived/derived bucket)`. Mapping jest **persystowany** — przy kolejnych latach od razu pre-fillujemy.
3. Każdy wiersz: parser daty `<MiesiącPL> (DD.MM)` + rok z header → `snapshot_date date`.
4. Merge: snapshoty pod istniejącymi `account_id` (po nazwie). `opened_at` = data pierwszego snapshota (np. „Santander Mieszkanie" → 2024-04).
5. Lifecycle: importer wykrywa „konto miało snapshoty do miesiąca X, potem cisza ≥3 miesiące w kolejnych latach" → dialog: „Zamknąć z datą X? (lub było tylko wpisane ad-hoc, ignoruj)". `closed_at` ustawiamy z odpowiedzi.
6. Konta zamknięte renderują się tylko w miesiącach `[opened_at, closed_at]`. W widoku tabeli — toggle „pokaż zamknięte". Net worth chart: balance = 0 od `closed_at`, historia pozostaje.

Skala: ~60 miesięcy × ~10 kont = ~600 snapshotów total. localStorage to udźwignie bez problemu, w bazie żaden temat.

To jest **3–4 godziny pracy** (z multi-year wspólnym mapperem). Zero AI/LLM, czysty parser.

---

## 6. Pytanie E — Roadmapa kolejnych funkcji

Posortowane wg **impact × małej złożoności** (na górze rzeczy, które dają najwięcej za najmniej):

### Priorytet 1 — domknięcie spójności z arkuszem (zamyka „dlaczego nadal używam Sheets")

1. **Stany kont (assets) + snapshoty miesięczne** — sekcja 5 powyżej. Kręgosłup. Bez tego apka nie zastąpi arkusza.
2. **Abonamenty jako osobna lista** — recurring fixed cost, suma do `monthlyExpenses`.
3. **Nadchodzące jednorazowe wydatki** — z miesiącem realizacji.
4. **Net worth chart** (linia: assets minus debts w czasie) — derived ze snapshotów + długów.
5. **Pie chart udziałów % na ostatni snapshot** + konfiguracja bucketów.

### Priorytet 2 — backend + sync

6. **Backend (FastAPI lub Node) + Postgres na `brain-db`** — sekcja 3.
7. **CI/CD + deploy na CT109** — sekcja 4.
8. **PWA / installable** — żeby działało na Foldzie 4 jako natywna apka. Vite ma plugin `vite-plugin-pwa`, ~30 min roboty.

### Priorytet 3 — inteligencja danych

9. **Real growth rate per bucket** — z historii snapshotów licz CAGR (cash separately od krypto separately od inwestycji).
10. **Save rate vs target** — % income który faktycznie ląduje w assets, miesięcznie.
11. **Projekcja FIRE** — przy real CAGR (nie liniowe), Monte Carlo dla wariantów (8/10/12% rocznie).
12. **Alerty / triggery** — `fundusz awaryjny < 6 × monthlyExpenses` → badge. `next charge subskrypcji za 3 dni` → notyfikacja.

### Priorytet 4 — UX nice-to-have

13. **Wielowalutowość** (Coinbase/Crypto.com w USD lub natywnych aktywach z konwersją PLN) — fetcher z CoinGecko + opcja manualnego pricingu.
14. **Współdzielenie z żoną (read-only link / multi-user)** — sensowne dopiero z backendem + auth.
15. **Auto-import wyciągów bankowych (CSV mBank/Alior)** — kategoryzacja transakcji. Duża rzecz, ale gigantyczna wartość. Może być etap 4 albo osobny projekt.
16. **Eksport raportu PDF/roczny przegląd** — generuje „rok 2026 w finansach" na podstawie danych.

### Priorytet 5 — outside-the-box

17. **Integracja z Todoist** — z brain-memory wynika, że Todoist jest twoim action layerem. Cel zbliża się do deadline'u → task. „Nadchodzący wydatek za 7 dni: 5650 zł na wyjazd" → task. Dzięki MCP możesz to robić.
18. **Snapshot ingestor z Sheets (opcjonalny live source)** — jeśli żona nadal wpisuje stany w Sheets, jednokierunkowy puller co tydzień. Tylko §1.1 (sztywna struktura).

---

## 7. Sugerowana kolejność prac (sprinty 2-tygodniowe)

**Sprint 1 — Assets w przeglądarce (no backend yet):**
- `Account`, `AccountSnapshot` types + Zustand slice.
- UI „Stany kont": tabela miesięczna, inline edit, CRUD kont.
- Importer CSV.
- Bucketing + 3 KPI (Suma majątku, Fundusz, Wkład).
- Net worth chart.
- **Deliverable:** szablon `Finanse - 2024.xlsx` w pełni przeniesiony do apki, lokalnie.

**Sprint 2 — Abonamenty i nadchodzące wydatki:**
- `Subscription`, `UpcomingExpense` + UI listy.
- Wpięcie w `MonthRow` (sumy do expenses, jednorazowe do konkretnego miesiąca).
- Markery na chartzie dla one-shotów.
- **Deliverable:** arkusz całkowicie redundantny, apka go zastępuje.

**Sprint 3 — Backend MVP + deploy:**
- Postgres schema na `brain-db` (sekcja 3).
- FastAPI (sugestia, bo masz już Pythona w pipelinie news/saves) z 2 endpointami: `POST /snapshot`, `GET /history`.
- Sync button w UI: `localStorage` → backend.
- CT109 + Tailscale + GitHub Actions deploy (sekcja 4).
- **Deliverable:** apka dostępna pod `savings.lan` w domu, dane w bazie, backup automatyczny przez Postgres dump.

**Sprint 4 — PWA + dostęp z telefonu:**
- `vite-plugin-pwa`, manifest, ikony.
- Cloudflare Tunnel route + Cloudflare Access (email auth — kupciu1@gmail.com whitelisted).
- **Deliverable:** dodajesz na ekran główny Folda 4, używasz w drodze.

**Sprint 5+ — inteligencja (FIRE projection, save rate, integracja Todoist, …).**

---

## 8. Otwarte decyzje do potwierdzenia

1. **Pytanie do Ciebie:** Sheets do trzymania na wieczność (historia 2024 jako archiwum) czy migrujemy też historię stanów? — Sugestia: migrujemy importerem, archiwum w formacie .xlsx zostaje na dysku.
2. **Pytanie do Ciebie:** FastAPI (Python — spójność z news/saves pipeline'em) czy Node/Express (spójność stacku z frontendem)? — Sugestia: FastAPI, bo i tak będziesz miał Pythona w homelabie i Pydantic v2 da Ci tańszą walidację.
3. **Pytanie do Ciebie:** Coolify od razu, czy najpierw zwykły workflow GitHub Actions? — Sugestia: Actions teraz, Coolify gdy będziesz miał ≥2 apki self-hosted.
4. **Pytanie do Ciebie:** Multi-user (Ty + żona) jest w planie? Jeśli tak, schema i auth od razu wieloużytkownikowe (`owner_id` na tabelach). Jeśli nie — single-tenant.
5. **Pytanie do Ciebie:** Krypto — manualnie wpisywać balance w PLN co miesiąc (jak w arkuszu) czy live pricing przez CoinGecko? — Sugestia: zacznij manualnie, live pricing to inny problem (assets vs prices).

---

## 9. Linki / referencje

- Repo: `E:\repo\savings-planner`
- Memory projektu: `E:\repo\brain-memory\PROJECTS\savings-planner.md`
- Stan homelabu: `E:\repo\brain-memory\STATE\homelab.md`
- Szablon źródłowy: `C:\Users\kupci\Downloads\Finanse - 2024.pdf`
- `brain-db` (Postgres docelowy): CT105 / `192.168.100.162`
- Reverse proxy: `nginx-proxy` CT103 / `192.168.100.153`
- Cloudflare Tunnel: `jakubmikolajczyk.com`
