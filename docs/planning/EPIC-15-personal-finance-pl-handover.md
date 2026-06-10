# EPIC 15 — Personal finance PL + beginner-friendly redesign (handover)

Data: 2026-06-10 · Commity: `50381dd..ffa6c0a` na `main` (forgejo)

## Co weszło

### C. Zwrot PIT z IKZE (`50381dd`)
- `IkzePlanEntry.pitRate` (0.12/0.19/0.32, select w planerze), `IKZE_LIMITS` 2024–2026 auto-uzupełniane.
- `calculateProjectedIkzeRefund` w [src/domain/ikze.ts](../../src/domain/ikze.ts); zwrot wpada jako wirtualny przychód w **maju roku następnego** w `buildSchedule` i jest oznaczony w tabeli harmonogramu.

### A. Multi-currency (`53cfd04`)
- [src/domain/fx.ts](../../src/domain/fx.ts): `fxRateToBase` / `convertToBase`; ręczne kursy w `settings.fxRates`, fallback `DEFAULT_FX_RATES` (EUR/USD/CHF/GBP), nieznana waluta = 1:1.
- Konwersja działa w: net worth (Przegląd), wykres net worth, struktura majątku (pie), KPI, sumy bucketów, bufory bezpieczeństwa, suma w tabeli snapshotów (konta walutowe mają podpowiedź „≈ X zł").
- Edytor kursów: Ustawienia → „Waluty i kursy".

### B. IKE / E. PPK / F. Belka (`ff09bd0`)
- [src/domain/ike.ts](../../src/domain/ike.ts): limity 2024–2026 (23 472 / 26 019 / 27 621), rekomendacja na wypłatę, toggle cashflow `includeIkeContributionsInCashflow`.
- [src/domain/ppk.ts](../../src/domain/ppk.ts): składki pracownik/pracodawca/państwo, opcjonalny koszt cashflow (składka pracownika), projekcja salda.
- [src/domain/belka.ts](../../src/domain/belka.ts): `projectMonthlyInvestment` — silnik porównania maklerskie (19%) vs IKE/IKZE (0%); UI: `BelkaEstimator`.
- Koszty IKE+PPK wchodzą do `expensesTotal` w `buildSchedule` i do kafelka „Koszty / mc" (pozycja „Emerytura").

### D. WIBOR/WIRON (`0384a00`)
- `MortgagePlan`: `referenceRateName`, `referenceRate`, `bankMargin`, `fixedRateUntil`.
- `buildWiborScenarios` ([src/domain/mortgage.ts](../../src/domain/mortgage.ts)): saldo w miesiącu resetu (po nadpłatach), rata przy WIBOR 4/6/8% + poziom bieżący, delta vs rata dzisiejsza. Edycja wskaźnika/marży auto-przelicza efektywne oprocentowanie.

### Redesign (`ffa6c0a`)
- Plan podzielony na pod-zakładki: **Budżet miesiąca / Cele i długi / Emerytura i podatki / Hipoteka** (`SubTabs` + `PlainIntro` w [Layout.tsx](../../src/components/ui/Layout.tsx)).
- Karta „Zacznij tutaj" (3 kroki) na Przeglądzie, gdy brak kont.
- Ziarno papieru, kaskadowe `rise-in` (szanuje `prefers-reduced-motion`), opisy sekcji prostym językiem.

## Backend
`SettingsDto`/`IkzePlanEntryDto`/`MortgagePlanDto` rozszerzone (fxRates, baseCurrency, ikePlans, ppk, pitRate, pola WIBOR) — JSONB blob, **bez migracji**. Bez tego nowe pola ginęłyby w round-tripie API (Jackson ignoruje nieznane pola). `compileKotlin` zielony.

## Stan / długi
- 178 testów FE zielonych, lint czysty.
- Kursy walut są ręczne — brak automatycznego pobierania NBP (świadomie, local-first).
- Sub-zakładka Planu nie jest w URL hash (stan lokalny komponentu).
- Scenariusze WIBOR są symulacją wyświetlaną w formularzu hipoteki; bazowy harmonogram dalej liczy się po `annualInterestRate`.

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Konto w EUR z saldem (np. 1000 EUR) podnosi net worth na Przeglądzie o ~4250 zł, a po zmianie kursu EUR w Ustawieniach → „Waluty i kursy" wartości na Przeglądzie/Majątku przeliczają się od razu
- [ ] W planerze IKZE wybór stawki PIT 32% pokazuje sensowny zwrot, a w harmonogramie miesięcznym (Plan → Budżet miesiąca) maj następnego roku ma dopisek „+ zwrot IKZE …"
- [ ] Plan → Emerytura i podatki: IKE pokazuje limit 27 621 zł na 2026 i rekomendację na wypłatę; włączenie „Odejmuj wpłaty IKE" obniża wolne środki na kafelku Przeglądu
- [ ] PPK po wpisaniu pensji brutto pokazuje rozbicie pracownik/pracodawca/państwo, a estymator Belki pokazuje przewagę IKE nad maklerskim przy tych samych założeniach
- [ ] Plan → Hipoteka: po wpisaniu wskaźnika, marży i „stała stopa do" karty scenariuszy WIBOR 4/6/8% pokazują skok raty od właściwego miesiąca
- [ ] Nawigacja po 4 pod-zakładkach Planu działa na telefonie (pigułki zawijają się, nic nie wystaje poza ekran), a na świeżym profilu przeglądarki Przegląd pokazuje kartę „Zacznij tutaj"
<!-- HUMAN-VERIFY:END -->
