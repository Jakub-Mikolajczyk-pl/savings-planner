# EPIC 1 — Handover do implementacji (Assets / stany kont we froncie)

Dokument wykonawczy dla modelu implementującego (Claude Code / Codex). Samowystarczalny — zawiera kontekst, wzorce do naśladowania, dokładne specyfikacje typów/komponentów i acceptance per chunk. **Local-only (Zustand + localStorage), bez backendu** — backend to EPIC 3/4.

> Plan nadrzędny: `docs/planning/ROADMAP-2026.md` (sekcja 6, EPIC 1). Decyzje scope: tamże + memory projektu. Ten plik rozwija EPIC 1 do poziomu „bierz i pisz".

---

## 0. Kontekst i zasady pracy

- **Repo:** `E:\repo\savings-planner`. Stack: React 19 + TS + Vite + Tailwind 4 + Zustand 5 (persist) + Recharts 3 + Vitest + dnd-kit + lucide-react.
- **Branch:** pracuj na `feat/epic-1-assets` (już utworzony z aktualnego `main`).
- **Push:** po każdym zielonym chunku pushuj do **OBU** remote'ów:
  ```bash
  git push origin feat/epic-1-assets
  git push forgejo feat/epic-1-assets
  ```
  (`origin` = GitHub, `forgejo` = `http://192.168.100.165:3000/jakub/savings-planner.git`)
- **Po każdym chunku:** `npm run lint && npm run build && npm test` muszą być zielone PRZED commitem.
- **Commit message:** konwencjonalny (`feat(assets): ...`), zakończony:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Checkpoint:** po domknięciu EPIC 1 zaktualizuj `E:\repo\brain-memory\PROJECTS\savings-planner.md` (done log + current_focus) — inaczej hook checkpointu blokuje. Drobne chunki nie wymagają osobnego checkpointu, ale całość EPIC 1 tak.
- **Język UI:** polski (jak reszta apki). Komentarze w kodzie po polsku, zwięzłe.

---

## 1. Kluczowe założenia domenowe (NIE pomiń)

1. **Carry-forward bilansu.** W arkuszu źródłowym nie każde konto ma wartość w każdym miesiącu (kolumny wypełniane nieregularnie). Bilans konta „na miesiąc X" = saldo z **ostatniego snapshota o miesiącu ≤ X**. Bez tego net worth zapada się w miesiącach bez wpisu. To jest serce helperów (`balanceAsOf`).
2. **Lifecycle kont.** `openedAt`/`closedAt` (oba `"YYYY-MM"`, opcjonalne). Konto renderuje się w tabeli tylko w `[openedAt, closedAt]`. W net worth po `closedAt` saldo = 0 (nie luka — suma majątku się nie fałszuje), historia zostaje.
3. **Assets ≠ cashflow.** To osobny dział danych. NIE wpinaj snapshotów w `allocation.ts`/harmonogram. Net worth chart (1.4) może odejmować długi (`loans` + `mortgagePlan`) ale to read-only odczyt, bez modyfikacji silnika.
4. **Granularność miesięczna.** Snapshoty po `"YYYY-MM"` (dzień z arkusza pomijamy — nieistotny do analiz).
5. **Multi-year.** Historia od `2022-05`. Tabela i wykresy muszą znieść ~60 miesięcy × ~10 kont.

---

## 2. Wzorce w kodzie do naśladowania

- **Store** `src/store/index.ts`: jeden `create()(persist(...))`, `name: 'savings-planner-v1'`, `partialize` wybiera pola do zapisu. Akcje mutują przez `set(s => ...)`. ID przez `crypto.randomUUID()`. **Dodaj nowe pola do `partialize`, `exportData`, `importData`, `resetAll`** — inaczej nie przetrwają reloadu ani backupu JSON.
- **Formatting** `src/domain/formatting.ts`: `formatPLN`, `formatYearMonth`, `addMonths`, `monthDiff`, `currentYearMonth`, `dateToYearMonth`. Reużywaj, nie duplikuj.
- **UI sekcje** `src/App.tsx`: każda sekcja w `<Collapsible title=... badge=...>`. Dodaj sekcję „Stany kont" w tym wzorcu.
- **Inputy waluty** `src/components/ui/CurrencyInput.tsx`. Inputy liczbowe rób tym komponentem.
- **Listy CRUD** wzór: `src/components/goals/GoalList.tsx` + `GoalForm.tsx`, `src/components/loans/LoanList.tsx` + `LoanForm.tsx`.
- **Wykresy** `src/components/chart/SavingsChart.tsx` (Recharts) — wzór dla net worth i pie.
- **Testy** `src/domain/allocation.test.ts`, `src/domain/mortgage.test.ts` — wzór vitest dla domeny.

---

## 3. CHUNK 1.1 — Typy + domena + slice store + testy

**Zależy od:** —. **Pliki:** `src/domain/types.ts`, nowy `src/domain/accounts.ts`, `src/store/index.ts`, nowy `src/domain/accounts.test.ts`.

### 3.1 Typy — dodaj do `src/domain/types.ts` (przed `MortgageOverpaymentMode`)

```ts
// ─── Assets: konta i ich stany w czasie (snapshoty) ──────────────────────────
export type AccountBucket = 'cash' | 'investment' | 'retirement' | 'down_payment' | 'crypto'

export interface Account {
  id: string
  name: string
  bucket: AccountBucket
  currency: string        // domyślnie 'PLN'
  openedAt?: string       // "YYYY-MM" — miesiąc pierwszego snapshota (auto-zarządzany)
  closedAt?: string       // "YYYY-MM" — undefined = aktywne; po tej dacie saldo = 0
}

export interface AccountSnapshot {
  accountId: string
  yearMonth: string       // "YYYY-MM"
  balance: number
  notes?: string
}
```

### 3.2 Domena — nowy `src/domain/accounts.ts`

Czyste funkcje (bez Zustand), w pełni testowalne. Wymagane:

```ts
import type { Account, AccountBucket, AccountSnapshot } from './types'

export const ACCOUNT_BUCKETS: AccountBucket[] = ['cash', 'investment', 'retirement', 'down_payment', 'crypto']

export const BUCKET_LABELS: Record<AccountBucket, string> = {
  cash: 'Gotówka / konta',
  investment: 'Inwestycje',
  retirement: 'Emerytalne',
  down_payment: 'Wkład własny',
  crypto: 'Krypto',
}

// Czy konto jest aktywne w danym miesiącu (lifecycle).
export function isActiveInMonth(account: Account, yearMonth: string): boolean

// Bilans konta NA dany miesiąc, z carry-forward (ostatni snapshot o miesiącu <= yearMonth).
// Zwraca 0 jeśli konto zamknięte (yearMonth > closedAt) lub brak snapshotów <= yearMonth.
export function balanceAsOf(snapshots: AccountSnapshot[], account: Account, yearMonth: string): number

// Najnowszy miesiąc snapshota dla konta (lub undefined).
export function latestSnapshotMonth(snapshots: AccountSnapshot[], accountId: string): string | undefined

// Min miesiąc snapshota dla konta — używane do auto openedAt.
export function earliestSnapshotMonth(snapshots: AccountSnapshot[], accountId: string): string | undefined

// Posortowana, unikalna lista wszystkich miesięcy występujących w snapshotach (rosnąco).
export function allSnapshotMonths(snapshots: AccountSnapshot[]): string[]

// Suma majątku na miesiąc: Σ balanceAsOf po wszystkich kontach (z carry-forward + lifecycle).
export function totalAssetsAsOf(accounts: Account[], snapshots: AccountSnapshot[], yearMonth: string): number
```

Uwagi implementacyjne:
- Porównania miesięcy = porównanie stringów `"YYYY-MM"` (leksykograficzne == chronologiczne).
- `balanceAsOf`: jeśli `account.closedAt` i `yearMonth > closedAt` → `0`. W przeciwnym razie filtruj snapshoty `s.accountId === account.id && s.yearMonth <= yearMonth`, weź ten o max `yearMonth`, zwróć `balance` lub `0`.

### 3.3 Slice w `src/store/index.ts`

Dodaj do interfejsu `AppState`, stanu początkowego, akcji, `partialize`, `exportData`, `importData`, `resetAll`:

- Stan: `accounts: Account[]` (init `[]`), `accountSnapshots: AccountSnapshot[]` (init `[]`).
- Akcje:
  - `addAccount(data: Omit<Account, 'id'>): void` — `id` via `crypto.randomUUID()`, `currency` default `'PLN'`.
  - `updateAccount(id, patch: Partial<Omit<Account, 'id'>>): void`
  - `removeAccount(id): void` — usuwa też wszystkie jego snapshoty.
  - `closeAccount(id, yearMonth): void` / `reopenAccount(id): void` (ustaw/wyczyść `closedAt`).
  - `setSnapshot(accountId, yearMonth, balance, notes?): void` — **upsert** po `(accountId, yearMonth)`; po zapisie zaktualizuj `account.openedAt = min(openedAt ?? ym, ym)`.
  - `removeSnapshot(accountId, yearMonth): void` — po usunięciu przelicz `openedAt` z pozostałych snapshotów (lub `undefined`).
- `partialize`: dopisz `accounts`, `accountSnapshots`.
- `exportData`/`importData`: dopisz oba pola (z fallbackiem `?? []`).
- `resetAll`: wyzeruj oba.

### 3.4 Testy — `src/domain/accounts.test.ts`

Pokryj minimum:
- `balanceAsOf` carry-forward (miesiąc bez snapshota bierze poprzedni).
- `balanceAsOf` = 0 po `closedAt`.
- `isActiveInMonth` granice `[openedAt, closedAt]`.
- `totalAssetsAsOf` sumuje wiele kont z różnymi lukami.
- `allSnapshotMonths` sortuje i deduplikuje.

**Acceptance 1.1:** testy domeny zielone; `lint`+`build`+`test` zielone; reload przeglądarki zachowuje konta i snapshoty; export/import JSON zawiera nowe pola.

---

## 4. CHUNK 1.2 — UI tabela stanów kont

**Zależy od:** 1.1. **Pliki:** `src/components/accounts/AccountsSection.tsx`, `AccountsTable.tsx`, `AccountForm.tsx`; podpięcie w `src/App.tsx`.

Wymagania:
- Sekcja „Stany kont" w `App.tsx` jako `<Collapsible>` (umieść nad „Cele" lub zaraz pod Hero — patrz altitude, sugestia: pod wykresem oszczędności).
- **Tabela:** wiersze = miesiące (rosnąco lub malejąco; daj sortowanie/najnowsze u góry), kolumny = konta. Komórka = **inline edit** salda (CurrencyInput) → `setSnapshot`. Pusta komórka = brak snapshota (placeholder „—"), ale wyświetlaj carry-forward na szaro jako podpowiedź (opcjonalnie, jasno odróżnione od realnego wpisu).
- **CRUD kont:** `AccountForm` (nazwa, bucket select z `BUCKET_LABELS`, waluta default PLN). Dodawanie kolumn „na żywo".
- **Lifecycle:** akcje zamknij/otwórz konto; **toggle „pokaż zamknięte"** (domyślnie ukryte). Konto zamknięte renderuj tylko w `[openedAt, closedAt]`.
- **Dodawanie miesiąca:** przycisk „dodaj miesiąc" (kolejny po najnowszym) albo wybór miesiąca.
- Wydajność: ~60×10 komórek — unikaj re-renderu całej tabeli na edycję jednej komórki (selektory Zustand per potrzeba, ewentualnie memoizacja wierszy).

**Acceptance 1.2:** można ręcznie odtworzyć układ z arkusza (dodać konta, wpisać salda po miesiącach); lifecycle respektowany; toggle działa.

---

## 5. CHUNK 1.3 — Buckety + 3 KPI

**Zależy od:** 1.1. **Pliki:** `src/components/accounts/AssetsKpi.tsx`; ewentualnie rozszerzenie `Settings` o konfigurację bucketów.

- Karty KPI dla **ostatniego miesiąca** (max `allSnapshotMonths`):
  - **Suma majątku** = `totalAssetsAsOf(...)`.
  - **Fundusz awaryjny** = Σ kont w bucketach należących do funduszu (domyślnie `cash` + `investment`).
  - **Wkład własny** = Σ kont w bucket `down_payment`.
- **Konfigurowalność:** mapowanie „które buckety wchodzą do funduszu awaryjnego" trzymane w stanie (np. `settings.emergencyFundBuckets: AccountBucket[]`), edytowalne w sekcji Zaawansowane. Jeśli przekombinowane — zrób stałą domyślną i zostaw `TODO` na konfigurację, ale preferuj prostą konfigurację checkboxami.
- Pokaż deltę m/m (opcjonalnie): zmiana sumy majątku vs poprzedni miesiąc.

**Acceptance 1.3:** KPI zgodne z ręcznym sumowaniem ostatniego miesiąca; zmiana przypisania bucketów aktualizuje fundusz awaryjny.

---

## 6. CHUNK 1.4 — Net worth chart

**Zależy od:** 1.1 (długi opcjonalnie). **Pliki:** `src/components/accounts/NetWorthChart.tsx`.

- Recharts: oś X = miesiące (`allSnapshotMonths`), seria główna = suma majątku (`totalAssetsAsOf` per miesiąc).
- Druga seria/obszar = **net worth netto** = majątek − długi. Długi: suma `loans[].remainingBalance` (stałe, brak historii — traktuj jako wartość bieżącą na całym horyzoncie LUB pokaż tylko od bieżącego miesiąca; udokumentuj wybór) + bilans hipoteki jeśli `mortgagePlan` (użyj `buildMortgageSchedule`/`mortgageSummary` jeśli wygodne, albo principal bieżący). **Trzymaj to read-only — nie zmieniaj silnika.**
- Konto zamknięte: po `closedAt` jego wkład = 0 (zapewnia `balanceAsOf`).
- Tooltip po polsku, `formatPLN`.

**Acceptance 1.4:** wykres pokrywa się liczbowo z danymi tabeli (suma kolumn = punkt serii); zamknięte konta nie psują sumy po dacie zamknięcia.

---

## 7. CHUNK 1.5 — Pie chart % udziału

**Zależy od:** 1.3. **Pliki:** `src/components/accounts/AssetsPie.tsx`.

- Recharts PieChart udziału na **ostatni miesiąc**. Tryb: udział wg bucketów (domyślnie) z opcją przełączenia na wg kont.
- Tylko konta aktywne w ostatnim miesiącu (`isActiveInMonth`).
- Etykiety z `%` i `formatPLN`; suma = 100%.

**Acceptance 1.5:** udziały sumują się do 100%; zgodne z KPI sumą majątku.

---

## 8. Definition of Done dla EPIC 1

- [ ] 1.1–1.5 zaimplementowane, każdy z acceptance spełnionym.
- [ ] `npm run lint && npm run build && npm test` zielone.
- [ ] Nowe testy domeny (`accounts.test.ts`) pokrywają carry-forward, lifecycle, sumy.
- [ ] Reload + export/import JSON zachowują konta i snapshoty.
- [ ] Branch `feat/epic-1-assets` wypchnięty do `origin` ORAZ `forgejo`.
- [ ] PR do `main` (base `main`), opis z listą chunków i acceptance.
- [ ] `brain-memory/PROJECTS/savings-planner.md`: done log + nowy current_focus (np. „EPIC 2 — abonamenty + nadchodzące wydatki").
- [ ] (Po review użytkownika) merge PR; potem `git push forgejo main` żeby Forgejo nadążał za GitHubem.

## 9. Świadome NIE w EPIC 1

- Brak backendu/synca (to EPIC 3/4). Wszystko w localStorage.
- Brak importera CSV (to EPIC 3 chunk 3.4 — silnik w Kotlinie; tu tylko ręczne wprowadzanie).
- Brak wielowalutowości realnej — pole `currency` istnieje, ale przeliczeń FX nie robimy (krypto i tak zamknięte; salda wpisywane w PLN).
- Brak analiz CAGR/save-rate/FIRE (to EPIC 7).
