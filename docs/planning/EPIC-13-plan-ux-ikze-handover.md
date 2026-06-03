# EPIC 13 - Plan UX + IKZE - handover

> Dla modelu wykonujacego. Status: gotowe do delegacji po rozbiciu na chunki.
> Decyzja IA dla "Prognozy celow i dlugow": wariant C - dashboard projekcji.

## Cel

Uczytelnic zakladke `Plan` i dodac roczny modul IKZE dla Jakuba i zony:

- IKZE ma pokazac limit roczny, stan wplat, kwote do doplaty oraz rekomendowana kwote na pozostale wyplaty do konca roku.
- `Miesieczny cashflow` ma miec wyrazna, zsumowana dana kosztow miesiecznych.
- `Kredyt hipoteczny` i `Harmonogram miesieczny` maja byc zwijane, bo sa dlugie.
- `Prognoza celow i dlugow` wymaga reworku ukladu, bo obecny wykres robi sie nieczytelny przy wielu celach, dlugach i markerach.

## Stan wejsciowy

- Stack: React 19, TypeScript, Vite, Tailwind 4, Zustand, Recharts, backend Kotlin/Spring Boot.
- Plan page: `src/App.tsx`, `PlanPage()`.
- Cashflow panel: `src/components/hero/Hero.tsx`.
- Prognoza: `src/components/chart/SavingsChart.tsx`.
- Actual-vs-plan: `src/components/goals/GoalInsightsSection.tsx`.
- Hipoteka: `src/components/mortgage/MortgageSection.tsx`.
- Harmonogram: `src/components/schedule/ScheduleTable.tsx`.
- Store/domain: `src/store/index.ts`, `src/domain/types.ts`, `src/domain/allocation.ts`.
- Backend settings sa JSONB singletonem: `finance.app_settings`, DTO w `backend/.../dto/FinanceDtos.kt`.
- Istnieje `src/components/ui/Collapsible.tsx`, ale dla kart planu lepiej rozszerzyc `SectionCard` o zwijanie, zeby nie zagniezdzac kart w kartach.

## 13.1 - IKZE planner roczny

### Cel

Dodac modul w `Plan`, ktory dla dwoch osob pokazuje:

- kto: Jakub / zona,
- typ limitu: przedsiebiorca / pracownik,
- rok,
- limit roczny wpisany recznie,
- juz wplacono wpisane recznie,
- zostalo do limitu,
- ile wyplat zostalo do konca roku,
- rekomendowana kwota na jedna wyplate,
- status: gotowe / w toku / brak limitu / limit przekroczony.

### Model danych

Proponowany frontend type:

```ts
type IkzeParticipantRole = 'employee' | 'entrepreneur'

interface IkzePlanEntry {
  id: string
  year: number
  ownerName: string
  role: IkzeParticipantRole
  annualLimit: number
  contributedAmount: number
  payoutsLeft: number
}
```

Najprostsze miejsce zapisu: `settings.ikzePlans?: IkzePlanEntry[]`.

Uzasadnienie: limity sa reczne i roczne, nie ma potrzeby tworzyc osobnej relacyjnej tabeli. Backend `app_settings` jest JSONB, a `SettingsDto` ma juz defaulty pod kompatybilnosc starych ustawien.

### UI

- Nowa sekcja w `Plan`, najlepiej po `Miesieczny cashflow`, przed wykresem prognozy.
- Tabela/karty dla dwoch wpisow: Jakub i zona.
- Pola edytowalne: rok, typ limitu, limit roczny, juz wplacono, liczba wyplat do konca roku.
- Domyslne wpisy przy pustym stanie:
  - `Jakub`, `entrepreneur`, aktualny rok, limit `0`, wplacono `0`, `payoutsLeft` policzone z miesiecy do grudnia.
  - `Zona`, `employee`, aktualny rok, limit `0`, wplacono `0`, analogicznie.
- Nie hardkodowac limitow IKZE. Jakub wpisuje je recznie co roku.

### Logika

- `remaining = max(annualLimit - contributedAmount, 0)`.
- `perPayout = payoutsLeft > 0 ? ceilToGrosze(remaining / payoutsLeft) : remaining`.
- `overLimit = contributedAmount > annualLimit && annualLimit > 0`.
- `missingLimit = annualLimit <= 0`.
- Suma rodzinna: limit razem, wplacono razem, zostalo razem, rekomendowana laczna rata per wyplata.

### Acceptance

- Widze osobno Jakuba i zone, z rozroznieniem `pracownik` vs `przedsiebiorca`.
- Mogę wpisac limit i stan obecnych wplat bez importu bankowego.
- Modul pokazuje ile jeszcze doplacic do limitu i ile wychodzi na pozostale wyplaty.
- Po reloadzie dane zostaja w store/backendzie.
- Export/import JSON zachowuje IKZE.
- Testy domeny pokrywaja: brak limitu, limit osiagniety, limit przekroczony, zero wyplat, podzial na N wyplat.

## 13.2 - Wyrazna suma kosztow w "Miesieczny cashflow"

### Cel

Obecnie `Hero` pokazuje koszty bazowe plus dopiski o abonamentach/jednorazowych/ratach, ale suma kosztow nie jest pierwszoplanowa. Dodac wyrazny fakt:

`Koszty lacznie: X zl / mies.`

### Zakres

- Plik glowny: `src/components/hero/Hero.tsx`.
- Korzystac z danych juz liczonych z `firstMonth`:
  - `settings.monthlyExpenses`,
  - `subscriptionsTotal`,
  - `oneTimeExpensesTotal`,
  - `totalDebtPayments`.
- Zachowac rozbicie jako szczegoly pod suma.
- Uwaga nazewnicza: jednorazowe sa "w tym miesiacu", nie stale miesieczne.

### Acceptance

- W panelu `Miesieczny cashflow` widac czytelna sume kosztow.
- Suma zgadza sie z tym, co odejmuje `buildSchedule` dla pierwszego miesiaca.
- Rozbicie nie znika: zycie, abonamenty, jednorazowe, raty.
- Nie podwajac hipoteki ani rat.

## 13.3 - Zwijane sekcje: hipoteka i harmonogram

### Cel

`Kredyt hipoteczny` i `Harmonogram miesieczny` sa dlugie. Zwinac je domyslnie albo dac stabilny toggle, zeby Plan byl skanowalny.

### Rekomendacja implementacyjna

Rozszerzyc `SectionCard` w `src/components/ui/Layout.tsx` o opcjonalne propsy:

```ts
collapsible?: boolean
defaultOpen?: boolean
collapsedSummary?: ReactNode
```

Nie uzywac `Collapsible` jako wrappera wewnatrz `SectionCard`, bo zrobi sie karta w karcie.

### Zakres

- `SectionCard` zachowuje dotychczasowe zachowanie, gdy `collapsible` nie jest ustawione.
- Dla `Kredyt hipoteczny`: `collapsible`, `defaultOpen={false}`.
- Dla `Harmonogram miesieczny`: `collapsible`, `defaultOpen={false}`.
- Collapsed summary:
  - hipoteka: saldo, rata, payoff month jesli jest plan,
  - harmonogram: liczba miesiecy horyzontu i liczba celow.

### Acceptance

- Obie sekcje sa zwiniete po wejsciu na Plan.
- Toggle jest dostepny klawiatura i ma sensowny `aria-expanded`.
- Po rozwinieciu nie gubi sie lokalny stan edycji w nieoczekiwany sposob; jesli dzieci sa odmontowywane, zaakceptowac to jawnie albo ukrywac przez CSS.
- Nie zmienia sie logika `MortgageSection` ani `ScheduleTable`.

## 13.4 - Rework "Prognoza celow i dlugow" - wariant C

### Problem

Obecny `SavingsChart` laczy w jednym wykresie:

- cele jako wypelnione area,
- dlugi jako linie,
- what-if,
- deadline celow,
- daty splaty dlugow,
- markery nadchodzacych wydatkow,
- metryki realnego tempa.

Przy obecnej ilosci informacji panel robi sie za ciasny. Dlugi sa praktycznie na dnie wykresu, bo skala Y jest zdominowana przez cele / wyzsze kwoty. Legenda i markery sa trudne do przeskanowania.

### Decyzja

Jakub wybral wariant C: dashboard projekcji, czyli chart + tabele priorytetow.

Nowy modul ma byc powierzchnia decyzyjna, nie tylko wykres. Ma odpowiadac na pytania:

- ktory cel jest najblizej / najbardziej zagrozony,
- ktory dlug schodzi najwolniej albo najwiecej zabiera miesiecznie,
- co zmienia what-if,
- gdzie kliknac, zeby zobaczyc konkretna serie bez szumu pozostalych.

### Warianty rozwazane

#### Wariant A - Jeden duzy panel, ale z przełącznikami warstw

- Wykres zostaje jeden i zajmuje pelna szerokosc.
- Nad wykresem sa toggles: `Cele`, `Dlugi`, `What-if`, `Deadline`, `Wydatki`.
- Pod wykresem jest osobna lista `Dlugi`, z kwota, rata, data splaty i efektem nadplaty.

Plus: najmniejsza zmiana domeny i komponentu.
Minus: dalej wspolna skala moze chowac male dlugi.

#### Wariant B - Dwa wykresy: Cele i Dlugi

- `Prognoza celow` jako glowny szeroki wykres.
- `Prognoza dlugow` jako osobny wykres nizej, z wlasna skala Y i tabela payoff.
- What-if pokazuje efekt osobno dla celow i dlugow.

Plus: najczytelniejsze dla dlugow; wlasna skala rozwiazuje problem "na dnie".
Minus: wiecej przestrzeni pionowej.

#### Wariant C - Dashboard projekcji: chart + tabele priorytetow

- Gora: szeroki wykres tylko dla aktywnie wybranej perspektywy (`Cele` albo `Dlugi`).
- Dol: dwie geste listy: `Najblizsze cele` i `Najblizsze splaty`.
- Klikniecie elementu podswietla serie na wykresie.

Plus: najlepsze do pracy decyzyjnej, mniej chaosu wizualnego.
Minus: wiekszy zakres implementacji i wiecej UX do doprecyzowania.

### Docelowy uklad

- Sekcja `Prognoza celow i dlugow` ma dostac wiecej przestrzeni: najlepiej pelna szerokosc, bez wciskania `Symulacja what-if` w prawa kolumne na tym samym poziomie.
- Na gorze: compact toolbar z segmentami:
  - `Cele`,
  - `Dlugi`,
  - `Wszystko`.
- Obok segmentow: male toggles warstw:
  - `What-if`,
  - `Deadline`,
  - `Wydatki`.
- Centralnie: jeden duzy wykres pokazujacy aktywna perspektywe.
  - `Cele`: serie celow + deadline + ewentualne what-if celu.
  - `Dlugi`: serie sald dlugow + daty splaty + what-if nadplat.
  - `Wszystko`: domyslnie nie pokazuj wszystkich serii naraz; pokaz tylko wybrana/podswietlona serie plus kontekst, zeby nie wrocic do obecnego chaosu.
- Pod wykresem: dwie listy robocze w jednej sekcji:
  - `Najblizsze cele`: nazwa, obecnie, cel, brakujaca kwota, ETA/status, plan/realnie per cykl.
  - `Najblizsze splaty`: nazwa, saldo, rata, ETA splaty, miesieczny koszt, efekt nadplaty jesli what-if aktywny.
- Klikniecie w wiersz listy ustawia `selectedProjectionId` i podswietla serie na wykresie.
- Akcje w listach maja prowadzic do istniejacych sekcji edycji (`Cele`, `Kredyty / raty`), bez duplikowania formularzy w dashboardzie.

### Podzial komponentow

- `src/components/chart/SavingsChart.tsx` rozbic albo zastapic:
  - `ProjectionDashboard.tsx` - kontener dashboardu.
  - `ProjectionChart.tsx` - wykres aktywnej perspektywy.
  - `ProjectionToolbar.tsx` - segmenty i toggles.
  - `ProjectionGoalList.tsx` - lista celow.
  - `ProjectionDebtList.tsx` - lista dlugow.
- Czysta logika przygotowania danych do `src/domain/projection.ts` albo lokalny helper testowalny bez Reacta.
- Zachowac `SavingsChart` jako cienki wrapper tylko jesli to ograniczy zakres zmian w `App.tsx`.

### Zachowanie domyslne

- Domyslna perspektywa: `Cele`, jesli sa aktywne cele; inaczej `Dlugi`, jesli sa dlugi.
- Domyslnie wybrany wiersz:
  - pierwszy cel `behind_plan`/`unreachable`, jesli istnieje,
  - potem najblizszy nieukonczony cel,
  - dla dlugow: najpozniejsza splata albo najwyzszy miesieczny koszt.
- Na mobile listy ida pod wykres, bez przewijanych mini-kolumn.

### Acceptance

- Dlugi nie sa juz nieczytelnymi liniami na dnie wykresu.
- Uzytkownik moze przelaczyc `Cele`/`Dlugi`/`Wszystko`.
- Klikniecie celu/dlugu w liscie zmienia podswietlenie na wykresie.
- Wykres nie pokazuje domyslnie chaotycznej legendy wszystkich serii naraz.
- What-if nadal dziala dla dochodu i nadplat, ale efekt jest czytelnie pokazany w aktywnej perspektywie i w listach.
- Desktop wykorzystuje wiecej szerokosci sekcji; mobile nie ma nakladajacych sie labeli ani tekstow poza kontenerem.
- Testy domeny pokrywaja przygotowanie list i wybor domyslnego elementu.

### Decyzje nadal potrzebne od Jakuba

- Czy what-if ma zostac wspolny, czy rozdzielony na `dochody/cele` i `nadplaty/dlugi`?
- Czy tryb `Wszystko` ma pokazywac tylko wybrana serie + kontekst, czy jednak wiele serii naraz po recznym zaznaczeniu?

## Proponowana kolejnosc delegacji

1. `13.2` suma kosztow w cashflow - szybkie, niskie ryzyko.
2. `13.3` zwijane sekcje - szybkie, czysto UI.
3. `13.1` IKZE planner - sredni zakres, nowe dane w settings + UI + testy.
4. `13.4` rework prognozy - wariant C, wiekszy chunk UI.

## Weryfikacja

- Front: `npm run lint`, `npm test -- --run`, `npm run build`.
- Backend przy zmianie `SettingsDto`: `backend ./gradlew.bat --no-daemon test`.
- Browser smoke: `/#/plan`, sprawdzic mobile i desktop.
