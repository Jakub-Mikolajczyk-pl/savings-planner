# EPIC 2 — Handover do implementacji (Abonamenty + nadchodzące wydatki)

Dokument wykonawczy dla modelu implementującego. Samowystarczalny. **Local-only (Zustand + localStorage), tylko aktualny stan — bez historii, bez tabel snapshot.** Po EPIC 2 arkusz `Finanse - YYYY` jest w pełni zastąpiony funkcjonalnie.

> Plan nadrzędny: `docs/planning/ROADMAP-2026.md` (EPIC 2). Wzór jakości i konwencji: `docs/planning/EPIC-1-handover.md` (EPIC 1 zaakceptowany, w `main`).

---

## 0. Kontekst i zasady pracy

- **Repo:** `E:\repo\savings-planner`. React 19 + TS + Vite + Tailwind 4 + Zustand 5 (persist) + Recharts 3 + Vitest.
- **Branch:** `feat/epic-2-subscriptions` (już utworzony z aktualnego `main` = b1a7d7c, zawiera EPIC 1).
- **Push do OBU remote'ów** po każdym zielonym chunku:
  ```bash
  git push origin feat/epic-2-subscriptions
  git push forgejo feat/epic-2-subscriptions
  ```
  (`forgejo` = `http://192.168.100.165:3000/jakub/savings-planner.git`. Jeśli push do forgejo zwróci `Authentication failed` — odśwież credentiale/token Forgejo; origin może iść niezależnie.)
- **Przed każdym commitem:** `npm run lint && npm run build && npm test` zielone.
- **Commit msg:** `feat(subscriptions): ...` / `feat(expenses): ...`, zakończony `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Po domknięciu EPIC 2:** zaktualizuj `E:\repo\brain-memory\PROJECTS\savings-planner.md` (done log + current_focus → „EPIC 3 backend"); przesuń kartę w Todoist (AI Workbench) do Done/Review.
- **UI po polsku.** Komentarze zwięzłe, po polsku.

---

## 1. Kluczowe założenia (NIE pomiń)

1. **Tylko aktualny stan.** Abonamenty i nadchodzące wydatki nie mają historii — prosty CRUD, zero snapshotów.
2. **Brak double-countingu.** `settings.monthlyExpenses` zostaje „wydatkami życiowymi BEZ abonamentów". Abonamenty i jednorazówki dokładane są w silniku osobno. Nie sumuj abonamentów do `monthlyExpenses` w stanie — licz je w `buildSchedule`.
3. **Abonament = koszt cykliczny** (co miesiąc, jeśli `active`). **Nadchodzący wydatek = jednorazowy** w konkretnym miesiącu (`targetMonth`).
4. **Silnik pozostaje czysty.** Rozszerzasz `buildSchedule` o dwa parametry z domyślnymi `[]` (zero churnu w istniejących testach), nie przepisujesz logiki alokacji.

---

## 2. Wzorce do naśladowania

- Store `src/store/index.ts`: wzór slice'ów z EPIC 1 (`accounts`/`accountSnapshots`) — CRUD, `partialize`, `exportData`/`importData` (z `?? []`), `resetAll`. **Pamiętaj dopisać nowe pola we wszystkich tych miejscach.**
- UI listy/CRUD: `src/components/loans/LoanList.tsx` + `LoanForm.tsx` (najbliższy wzór — prosta lista z kwotami).
- Sekcje: `src/App.tsx` w `<Collapsible>`. Inputy waluty: `src/components/ui/CurrencyInput.tsx`.
- Wykres + markery: `src/components/chart/SavingsChart.tsx` (Recharts — dodasz `ReferenceLine`).
- Testy domeny: `src/domain/allocation.test.ts` (rozszerz o przypadki z abonamentami/jednorazówkami).

---

## 3. CHUNK 2.1 — Typy + slice store + testy

**Pliki:** `src/domain/types.ts`, `src/store/index.ts`, (testy) `src/domain/allocation.test.ts` lub nowy `src/store` test.

### 3.1 Typy (dodaj do `types.ts`)

```ts
export interface Subscription {
  id: string
  name: string
  monthlyAmount: number
  active: boolean
  category?: string
  nextCharge?: string   // "YYYY-MM-DD", opcjonalne (pod alerty w EPIC 7)
}

export interface UpcomingExpense {
  id: string
  name: string
  amount: number
  targetMonth: string   // "YYYY-MM" — miesiąc realizacji
  isPaid: boolean
}
```

### 3.2 Rozszerz `MonthRow` (types.ts) o rozbicie kosztów

```ts
// w interface MonthRow dodaj:
  subscriptionsTotal: number     // suma aktywnych abonamentów w tym miesiącu
  oneTimeExpensesTotal: number   // suma nieopłaconych jednorazówek z targetMonth === yearMonth
```
`expenses` POZOSTAJE = wydatki życiowe (base). Dzięki temu UI pokaże rozbicie bez double-countingu.

### 3.3 Slice store

- Stan: `subscriptions: Subscription[]` (init `[]`), `upcomingExpenses: UpcomingExpense[]` (init `[]`).
- Akcje:
  - `addSubscription(data: Omit<Subscription,'id'>)`, `updateSubscription(id, patch)`, `removeSubscription(id)`, `toggleSubscription(id)` (przełącza `active`).
  - `addUpcomingExpense(data: Omit<UpcomingExpense,'id'>)`, `updateUpcomingExpense(id, patch)`, `removeUpcomingExpense(id)`, `toggleUpcomingPaid(id)` (przełącza `isPaid`).
- `partialize`, `exportData`, `importData` (`?? []`), `resetAll` — dopisz oba pola.
- `getSchedule`/`getWhatIfSchedule`: przekaż `subscriptions` i `upcomingExpenses` do `buildSchedule` (patrz 5).

**Acceptance 2.1:** reload + export/import zachowują dane; testy slice'a/silnika zielone; lint/build/test OK.

---

## 4. CHUNK 2.2 — UI listy CRUD

**Pliki:** `src/components/subscriptions/SubscriptionList.tsx` + `SubscriptionForm.tsx`; `src/components/expenses/UpcomingExpenseList.tsx` + `UpcomingExpenseForm.tsx`; podpięcie w `App.tsx`.

- Dwie nowe sekcje `<Collapsible>` w `App.tsx` (np. „Abonamenty" i „Nadchodzące wydatki") — umieść po „Kredyty / Raty", przed „Kredyt hipoteczny".
- **Abonamenty:** lista z nazwą, kwotą/mc, kategorią (opcj.), przełącznikiem `active` (nieaktywne wyszarzone, nie liczą się do sumy). Badge z sumą aktywnych w nagłówku sekcji.
- **Nadchodzące wydatki:** lista z nazwą, kwotą, miesiącem (`input type="month"`), checkbox „opłacone". Sortuj po `targetMonth`. Opłacone wyszarzone / na dole.
- Formularze wzorowane na `LoanForm`. CurrencyInput dla kwot.

**Acceptance 2.2:** CRUD obu list działa; toggle active/paid działa; sumy w nagłówkach poprawne.

---

## 5. CHUNK 2.3 — Wpięcie w cashflow (silnik + UI)

**Pliki:** `src/domain/allocation.ts`, `src/components/hero/Hero.tsx`, `src/components/schedule/ScheduleTable.tsx`, `src/components/chart/SavingsChart.tsx`.

### 5.1 `buildSchedule` — rozszerz sygnaturę (parametry z domyślnymi `[]`)

```ts
export function buildSchedule(
  settings: Settings,
  goals: Goal[],
  loans: Loan[],
  overrides: Overrides,
  whatIfDelta = 0,
  loanOverpayment = 0,
  mortgagePlan?: MortgagePlan,
  subscriptions: Subscription[] = [],
  upcomingExpenses: UpcomingExpense[] = [],
): Schedule
```

W pętli miesięcznej (obecnie linie ~143-201):
```ts
const subscriptionsTotal = subscriptions
  .filter(s => s.active)
  .reduce((sum, s) => sum + s.monthlyAmount, 0)

const oneTimeExpensesTotal = upcomingExpenses
  .filter(e => !e.isPaid && e.targetMonth === yearMonth)
  .reduce((sum, e) => sum + e.amount, 0)

const baseExpenses = override.expenses ?? settings.monthlyExpenses
const expensesTotal = baseExpenses + subscriptionsTotal + oneTimeExpensesTotal
```
- Podmień użycia `expenses` w `grossFreeCash` i `freeCash` na `expensesTotal`.
- W `rows.push({...})`: `expenses: baseExpenses` (bez zmian znaczenia), DODAJ `subscriptionsTotal`, `oneTimeExpensesTotal`.
- `isDeficit` liczone od `freeCash` (już uwzględni nowe koszty).

⚠️ Double-counting: `subscriptionsTotal` licz RAZ przed pętlą (stałe), `oneTimeExpensesTotal` per miesiąc.

### 5.2 UI
- **Hero:** dodaj read-only linię „Abonamenty: X zł/mc" (suma aktywnych) obok wydatków. Jasno że to osobna pozycja od „Wydatki życiowe".
- **ScheduleTable:** w wierszu miesiąca pokaż rozbicie (życiowe / abonamenty / jednorazowe) lub przynajmniej łączne koszty + tooltip. Jednorazówki widoczne w swoim miesiącu.
- **SavingsChart:** dodaj pionowe `ReferenceLine` (Recharts) na miesiącach z nieopłaconą jednorazówką, z etykietą nazwy/kwoty. Wzór osi X już jest w komponencie.

**Acceptance 2.3:** suma abonamentów wpływa na `freeCash` każdego miesiąca; jednorazówka obniża `freeCash` tylko w swoim miesiącu; brak double-countingu (życiowe + abonamenty + jednorazowe = łączny koszt); markery na wykresie w odpowiednich miesiącach; istniejące 20 testów dalej zielone + nowe testy na subskrypcje/jednorazówki.

---

## 6. Definition of Done

- [ ] 2.1–2.3 z acceptance spełnionym.
- [ ] `npm run lint && npm run build && npm test` zielone (20 istniejących + nowe).
- [ ] Nowe testy: abonamenty obniżają freeCash co miesiąc; jednorazówka tylko w targetMonth; toggle active/paid wyłącza z kalkulacji.
- [ ] Reload + export/import JSON zachowują subscriptions i upcomingExpenses.
- [ ] Branch wypchnięty do `origin` ORAZ `forgejo`.
- [ ] PR do `main`; po review/merge przez Jakuba: ujednolicić oba remote'y (origin+forgejo na ten sam SHA).
- [ ] brain-memory done log + current_focus zaktualizowane; karta Todoist przesunięta.

## 7. Świadome NIE w EPIC 2

- Bez backendu/synca (EPIC 3/4). Wszystko w localStorage.
- Bez historii abonamentów/wydatków (tylko aktualny stan).
- Bez alertów „abonament za 3 dni" (to EPIC 7.4 — `nextCharge` jest tylko polem na przyszłość).
- Bez kategoryzacji/raportów (EPIC 7).
