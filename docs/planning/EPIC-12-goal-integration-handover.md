# EPIC 12 — Wpięcie w cele: realne tempo + wolna gotówka per cykl — handover

> Dla modelu wykonującego. Samowystarczalny. Domyka serię 8–12. Czytaj razem z handoverami
> EPIC 8/9/10/11 i `ROADMAP-2026.md`. To EPIC, który zamienia całą serię w realną wartość:
> deklaracje w celach → actual-vs-plan z faktycznych transakcji.

## Cel

Realne transakcje karmią ISTNIEJĄCE cele — **actual-vs-plan zamiast deklaracji**. Pod odbudowę
bufora po remoncie. Liczy się: ile wolnej gotówki zostaje per cykl i jakim realnym tempem rosną cele.

## Stan wejściowy (co JUŻ istnieje — nie buduj od zera)

Cała seria 8–11 jest na **forgejo/main** (HEAD `5ae4e19`). Artefakty pod EPIC 12:

- **`finance.transactions`** (V3+V4): `amount` (dodatnia=wpływ, ujemna=wydatek), `category_id` → 
  `finance.categories(kind ∈ {variable, fixed, recurring})`.
- **`finance.pay_periods`** + view **`finance.tx_with_period`** (V5) — cykle „od wypłaty do wypłaty".
  `PayPeriodRepository.listPayPeriods()` zwraca już `income/expense/net` per cykl. Serwis/repo w
  `backend/.../payperiod/`.
- **`finance.cycle_category_rollup`** (V6, EPIC 11) — suma/expense/count per (cykl × kategoria) z
  `category_kind`. To gotowe wejście do liczenia kosztów fixed/recurring per cykl.
- **Cele/KPI/SavingsChart we froncie ISTNIEJĄ** (EPIC 1): typy `Goal` w `src/domain/types.ts`,
  store w `src/store/index.ts`, KPI i `SavingsChart` w `src/components/`, `goalsApi` w
  `src/api/client.ts`. Backend celów: `GoalController` w `FinanceControllers.kt`, schema w V1.
- Front zakładka „Transakcje" (`TransactionsPage` w `src/App.tsx`) ma `PayPeriodsSection`,
  `LeakAnalysisSection`, `IngestSection`. Wzór sekcji: Collapsible / `SectionCard`.

Migracje Flyway: istnieją **V1–V6** → następna to **V7**. Schema = `finance`.

## Zadania

- [ ] **12.1** view `free_cash_per_cycle` = wpływ − koszty (kategorie `kind ∈ {fixed, recurring}`)
  per cykl. Buduj na `cycle_category_rollup` (ma już `category_kind` i `expense` per cykl). Zdecyduj
  jawnie co z `variable` i `Bez kategorii` — to NIE są koszty stałe, więc wolna gotówka = wpływ −
  (fixed+recurring); wydatki variable są „uznaniowe" i pokazują ile z wolnej gotówki realnie poszło.
- [ ] **12.2** cele: realne tempo odkładania z faktycznego netto vs target + projekcja „przy obecnym
  tempie cel za N cykli". Tempo licz z historii cykli (np. średni `net` lub średnia `free_cash` z
  ostatnich N pełnych cykli — pomiń `is_partial`). Projekcja: `(target − current) / tempo_na_cykl`.
- [ ] **12.3** front: na celu widok **actual-vs-plan** + pasek wolnej gotówki bieżącego cyklu;
  zasilenie istniejących KPI/SavingsChart realnymi danymi (nie tylko deklaracją).
- [ ] **12.4** (opcj.) kategorie jako linie budżetu, jeśli planer ma pojęcie budżetu.
- [ ] **12.5** spójność z drugim mózgiem: surowe tx zostają w db-finance (FIREHOSE); do brain-memory
  trafia tylko DECYZJA (np. „budżet na X = Y"), nie surowe wydatki — ta sama linia podziału co
  firehose vs canonical state.

## Definition of Done

- Cel pokazuje realne tempo + projekcję z faktycznego netto (a nie tylko deklarowaną wpłatę).
- Wolna gotówka per cykl liczona automatycznie (wpływ − koszty fixed/recurring).
- Spójność: `free_cash_per_cycle` daje się pogodzić z `net`/rollupami z EPIC 10/11.

## Pułapki

- **Nie podwójnie licz** kosztów: fixed/recurring z kategorii vs to co już jest w `monthlyExpenses`
  planera (EPIC 2.3 wpinało abonamenty). Ustal jedno źródło prawdy dla danego cyklu.
- `is_partial` cykle (pierwszy/ostatni) zaniżają tempo — wyłączaj z liczenia średniej.
- Realne tempo bywa ujemne (cykl na minusie) — projekcja „cel za N cykli" musi to obsłużyć (np.
  „przy obecnym tempie cel nieosiągalny"), nie dzielić przez ≤0.
- Kategorie bez `kind` / `Bez kategorii` — zdecyduj świadomie czy wpadają do kosztów; inaczej wolna
  gotówka kłamie. Najlepiej pokaż je osobno jako „niesklasyfikowane".

## Zależności, branch, konwencje

- **Zależy od**: EPIC 8 (tx) + 9 (kategorie `kind`) + 10 (cykle) + 11 (rollup) — wszystkie na
  forgejo/main. Łączy się z EPIC 7.2 (save rate vs target) i 7.3 (FIRE) — to ich realne zasilenie.
- **Branch**: `feat/epic-12-goal-integration`. Odbij od **forgejo/main** (`5ae4e19`). UWAGA:
  `origin/main` (GitHub) jest mocno w tyle (`dc85abc`, brak 8–11) — **forgejo jest źródłem prawdy dla
  main**. Pushuj branch na oba remoty.
- **Merge do `main` (forgejo) = produkcyjny deploy** na savings.lan (CD z EPIC 5, CT111). Bez
  auto-merge bez zgody właściciela.
- **Stos/testy**: Kotlin + Spring Boot, monorepo `backend/`, Flyway (następna V7), Testcontainers PG17
  (`disabledWithoutDocker=true` → bez Dockera POMIJANE; lokalnie i tak nie startują, licz na CI).
  Logikę tempa/projekcji pokryj **unit testami bez bazy** (wzór `LeakAnalysisEngineTest`,
  `PayPeriodEngineTest`), a `free_cash_per_cycle`/view — Testcontainers (wzór
  `LeakAnalysisRepositoryTest`). Kod dydaktyczny (nauka Kotlina), styl komentarzy „INTERVIEW Q". Po
  zakończeniu: lint/build/test zielone (front+backend).

## Po EPIC 12

To domyka serię 8–12 (realny pipeline: ingest → kategorie → cykle → wycieki → cele). Otwarte wątki
po serii (z ROADMAP / tasków): EPIC 6 (PWA), EPIC 7.x (CAGR/FIRE/alerty/PDF), realny fixture PDF Velo
(dług z EPIC 8), pełny LLM fallback 9.4 (dziś tylko materializacja werdyktu jako reguła).
