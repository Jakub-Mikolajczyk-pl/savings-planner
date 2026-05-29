# REDESIGN frontu — Handover do implementacji (podział domenowy + frontend-design)

Dokument wykonawczy. Cel: przeprojektować UI z „jednej długiej listy Collapsible'ów" w **aplikację z podziałem domenowym**, lepszą hierarchią wizualną i wykorzystaniem dużego ekranu. **To zmiana PREZENTACYJNA** — logika domeny, store, sync i API zostają nietknięte.

> Kontekst E2E: użytkownik zgłosił — apka zbyt basic, ~60% ekranu, dane wizualnie nierozdzielone, podział nie-domenowy (monthly snapshot miesza się z cashflow), fundusz awaryjny/buckety niewidoczne. Nadrzędne: ROADMAP-2026.md. Konwencje merge/remote: brain-memory CONVENTIONS.md.

---

## 0. Zasady pracy i TWARDE ograniczenia

- **Repo:** `E:\repo\savings-planner`. **Branch:** `feat/redesign-domain-ui` (z `main`, ma EPIC 1–5 + fixy).
- **Push do OBU** (origin + forgejo) po chunku. Forgejo auth bywa migotliwy — retry. Merge LOKALNIE → push do obu (nie web UI; patrz CONVENTIONS).
- **Weryfikacja przed commitem:** `npm run lint && npm run build && npm test` — **25 testów MUSI zostać zielonych**. Dodawaj testy komponentów gdzie sensowne.
- To praca **React 19 / TypeScript / Tailwind 4** (nie Kotlin — bez dydaktyki jak w backendzie, ale czysty, idiomatyczny kod).

### ⛔ Czego NIE wolno ruszać (redesign = warstwa widoku)
- `src/domain/*` (allocation, mortgage, accounts, formatting, types) — logika i typy bez zmian.
- `src/store/index.ts` — akcje, sync, optimistic/rollback, hydratacja, persist, tryby local/api.
- `src/api/client.ts`, `src/config.ts` — kontrakt API.
- **Żadnych nowych pól persystowanych w `Settings`** — to wymusiłoby zmianę backendu (DTO/jsonb) i wychodzi poza „frontend-only". Buckety konfiguruj WYŁĄCZNIE na istniejącym `settings.emergencyFundBuckets` (już round-trippuje przez backend).
- Zachować: dark mode, export/import JSON, sync indicators, import CSV, tryby local + api.

Jeśli wyjdzie, że „ładnie" wymaga zmiany danych/logiki — **STOP**, zgłoś, to inny task.

---

## 1. Pryncypia (frontend-design)

1. **Information architecture first.** Pogrupuj wg modelu mentalnego użytkownika w domeny (sekcja 2), nie wg przypadkowej kolejności komponentów.
2. **Hierarchia wizualna.** Tytuł strony → nagłówki sekcji z ikoną → KPI (duże liczby, `tabular-nums`) → dane szczegółowe (mniejsze). Jeden dominujący element na ekran.
3. **Karty i grupowanie.** Każda logiczna grupa = karta z nagłówkiem. Powiązane karty w gridzie (2–3 kolumny na dużym ekranie), nie jeden pionowy stos.
4. **Przestrzeń.** Hojny whitespace, spójna skala odstępów (tokeny Tailwind), oddech między domenami. Pełna szerokość z komfortowymi marginesami (kontener ~`max-w-[1600–1800px]`, gutters `px-6/8`).
5. **Akcenty domenowe (subtelnie).** Każda domena ma akcent (ikona + delikatny kolor nagłówka/obramowania), NIE pełne tło. Np. Majątek = niebieski/emerald, Plan = violet/amber. Spójnie.
6. **Semantyka koloru.** Zielony/czerwony = +/−, deficyt, on-time/missed (jak już jest). Kwoty zawsze przez `formatPLN`.
7. **Stany.** Dobre empty states (część jest), spinner przy `isHydrating` (tryb api), widoczny status sync (`lastSyncedAt`/`syncError` ze store), loading dla wykresów.
8. **Dostępność.** Nawigacja klawiaturą (taby), `aria-*`, focus-visible, kontrast. Money z `tabular-nums`.
9. **Ruch.** Subtelne `transition-colors`/fade, bez przesady.
10. **Desktop-first, responsywne w dół.** Główne użycie to duży monitor; ma działać też na Foldzie 4 (mobile collapse), ale priorytet desktop.

---

## 2. Architektura informacji + nawigacja

Zamiast jednej kolumny Collapsible'ów → **nawigacja zakładkowa** (górny sticky tab bar, full-width shell). 4 sekcje:

### 🏠 Przegląd (Dashboard) — read-only, „rzut oka"
Cross-domain podsumowanie: **Net worth (duża liczba) + delta m/m**, KPI (Suma majątku / Fundusz awaryjny / Wkład własny), Wolne środki/mc (z harmonogramu), najbliższe cele (progress) i najbliższe nadchodzące wydatki, mini net-worth chart + struktura majątku (pie). Przyciski/linki skaczące do domen. Komponuje z istniejących derived/store — nic nowego w logice.

### 💰 Majątek (Assets) — „ile mam / net worth"
- KPI (AssetsKpi), NetWorthChart, AssetsPie.
- Konta: CRUD (AccountForm) + tabela snapshotów (AccountsTable) + import CSV (ImportCsvDialog).
- **Konfiguracja grup KPI (buckety) — first-class TUTAJ** (sekcja 4).
- ⛔ BEZ cashflow (income/expenses/cele/harmonogram).

### 📊 Plan (Cashflow) — „jak płyną pieniądze / planowanie"
- Income/expenses (Hero), SavingsChart + WhatIfSlider.
- Cele (GoalList), Kredyty (LoanList), Hipoteka (MortgageSection).
- Abonamenty (SubscriptionList), Nadchodzące wydatki (UpcomingExpenseList).
- Harmonogram miesięczny (ScheduleTable).
- ⛔ BEZ tabeli snapshotów (to Majątek).

### ⚙️ Ustawienia
- AdvancedSettings: horyzont/start, bazowe income/expenses, export/import, reset, status sync/backend.
- (Konfiguracja bucketów: kontekstowo w Majątku; tu ewentualny skrót.)

**Nawigacja techniczna:** lekki tab state. Rekomendacja: **hash routing** (`#/majatek`, `#/plan`...) na `window.location.hash` + `hashchange` — deep-link i back button, bez biblioteki routera. Albo `useState` jeśli wolisz prościej (ale tracisz tab po reloadzie). Bez dodawania react-router (zbędny ciężar).

---

## 3. Backlog chunków (inkrementalnie, reviewowalnie)

### R.1 — App shell: nawigacja + tokeny + layout
Tab bar (sticky, full-width), responsywny kontener, wspólne prymitywy w `src/components/ui/`: `PageHeader`, `SectionCard` (karta z nagłówkiem+ikoną), `StatCard`/`Kpi` (ujednolicić z istniejącym KpiCard z AssetsKpi). **Przenieś istniejące sekcje pod właściwe zakładki BEZ zmiany ich wnętrza** (owijasz obecne komponenty). *Acceptance:* cała dotychczasowa funkcjonalność dostępna pod nową nawigacją; dark mode OK; lint/build/test zielone.

### R.2 — Przegląd (Dashboard)
Nowa strona z podsumowaniem (sekcja 2) z derived/store. Tylko odczyt + nawigacja do domen. *Acceptance:* glanceable, liczby zgodne z domenami, skróty działają.

### R.3 — Majątek: layout + buckety first-class
Ułóż AccountsSection: rząd KPI → rząd wykresów (NetWorth + Pie) → tabela (full-width, sticky) + import CSV. **Konfiguracja bucketów funduszu** (sekcja 4) widoczna i czytelna. *Acceptance:* domena tylko-assets; buckety konfigurowalne i jasne (widać które wchodzą do funduszu).

### R.4 — Plan: layout cashflow
Uporządkuj komponenty cashflow w spójną stronę (inputy → wykres+whatif → karty cele/kredyty/hipoteka → abonamenty/wydatki → harmonogram). *Acceptance:* domena tylko-cashflow; brak tabeli snapshotów.

### R.5 — Paging/collapse długich harmonogramów
ScheduleTable + harmonogram w MortgageSection: paginacja albo collapse/„pokaż więcej" dla 300+ wierszy (hipoteka bywa ~360). *Acceptance:* długie harmonogramy wydajne i nawigowalne, bez przycinania danych.

### R.6 — Polish pass
Empty states, spinner `isHydrating`, status sync (`lastSyncedAt`/`syncError`), spójne odstępy/typografia/ikony (lucide), a11y (tab keyboard nav, aria, focus), sprawdzenie responsywności (desktop→Fold). *Acceptance:* spójny, dopracowany wygląd; lint/build/test zielone.

---

## 4. Buckety — konfigurowalne grupowania (frontend-only)

Decyzja użytkownika: **zostają stałe typy** (`cash/investment/retirement/down_payment/crypto`), konfigurowalny jest **wybór, które wchodzą do KPI funduszu awaryjnego**, i ma być **widoczny first-class** (teraz zakopany w Zaawansowane, KPI mówi tylko „Wybrane buckety").

- Źródło prawdy: istniejące **`settings.emergencyFundBuckets`** (już round-trippuje przez backend — NIE dodawaj nowych pól Settings).
- W Majątku: inline panel „Fundusz awaryjny = " z chipami/checkboxami typów bucketów; zmiana od razu przelicza KPI. Pokaż liczbowo wkład każdego bucketa.
- KPI „Fundusz awaryjny" subtitle: zamiast „Wybrane buckety" → wymień realne (np. „Gotówka + Inwestycje").
- „Wkład własny" zostaje = bucket `down_payment` (stałe; rozszerzenie na konfigurowalne wymagałoby nowego pola Settings = poza zakresem).
- Usuń duplikat configu z AdvancedSettings albo zostaw jako skrót — jedno źródło UI, bez rozjazdu.

---

## 5. Definition of Done

- [ ] R.1–R.6 z acceptance.
- [ ] Nawigacja domenowa; snapshot table TYLKO w Majątku; cashflow TYLKO w Plan.
- [ ] Pełne wykorzystanie szerokości na dużym ekranie; responsywne w dół.
- [ ] Buckety funduszu widoczne i konfigurowalne (na `emergencyFundBuckets`).
- [ ] Paging/collapse długich harmonogramów.
- [ ] Zero zmian w domenie/store/api; dark mode, export/import, sync, CSV import dalej działają.
- [ ] `npm run lint && npm run build && npm test` zielone (25 + nowe).
- [ ] Branch na origin + forgejo; merge lokalny → push do obu; brain-memory + Todoist zaktualizowane.

## 6. Świadome NIE
- Brak własnych (user-defined) typów bucketów — to wymaga backendu (osobny task).
- Brak PWA/mobile-native (to późniejszy EPIC 6).
- Brak nowej biblioteki routera (hash routing własny wystarczy).
- Brak zmian kontraktu API / logiki wyliczeń — czysta prezentacja.
