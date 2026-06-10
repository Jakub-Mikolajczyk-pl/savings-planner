# EPIC 16 — Feedback loop: plan vs rzeczywistość + automatyzacje (handover)

Data: 2026-06-11 · Commity: `79c1639..` na `main` (forgejo)

## Co weszło

### 0. Fix pipeline'u human-verify (`79c1639`)
Notify po deployu szukał `epic-N` małymi literami w temacie commita — commity `EPIC-15`/feat bez epica dawały „NO human-verify checklist". Teraz: (1) handover zmieniony w deployowanym commicie, (2) slug case-insensitive, (3) najwyższy numer handovera z blokiem. Checklist jest HTML-escapowany.

### 1. Plan vs wykonanie (`5f5f524`)
- `GET /api/reconciliation/monthly?months=N` — agregaty miesięcy kalendarzowych z `finance.transactions` (internal_transfer pomijany, savings liczone osobno, licznik bez kategorii).
- [src/domain/reconciliation.ts](../../src/domain/reconciliation.ts): plan liczony tym samym `buildSchedule` od najstarszego miesiąca z transakcjami; odchylenia asymetryczne (przekroczenie wydatków złe, przekroczenie dochodów dobre; progi 10%/25%).
- Sekcja „Plan vs wykonanie" na Plan → Budżet miesiąca.

### 2. Telegram nudges (`bd99478`)
- Spring `@Scheduled` (Europe/Warsaw): ostatni dzień miesiąca 18:00 — konta bez snapshota; 1. dzień 10:00 — pozostałe limity IKZE/IKE + alarm końca stałej stopy hipoteki (≤3 mies.).
- `POST /api/nudges/test` + przycisk w Ustawieniach. **Wymaga dopisania `TELEGRAM_BOT_TOKEN` i `TELEGRAM_CHAT_ID` do `/opt/savings-planner/.env` na CT111** (te same wartości co secrety forgejo); bez nich nudges są no-opem.

### 3. Propozycje snapshotów (`51220dd`)
- `GET /api/reconciliation/snapshot-suggestions?yearMonth=` — ostatnie znane saldo + delta transakcji; tylko konta z ingestem i bez snapshota w danym miesiącu.
- Panel „Propozycje sald" nad tabelą snapshotów (Majątek), przyjęcie = zwykły `setSnapshot`.

### 4. Kursy NBP (`7ef6f95`)
- `GET /api/fx/rates` — tabela A z api.nbp.pl, cache 6h, stary cache przy awarii sieci.
- Przycisk „Pobierz aktualne kursy z NBP" w edytorze walut wypełnia `settings.fxRates`; ręczne wartości pozostają jedynym źródłem prawdy dla przeliczeń.

### 5. Zapisane scenariusze (`defbc6b`)
- `PlanScenario` w settings (JSONB, bez migracji); każdy scenariusz liczony pełnym silnikiem i porównany z bazą (wolne środki, przesunięcia ETA celów i spłat). Sekcja na Plan → Cele i długi.

### 6. Projekcja FIRE (`7e33069`)
- [src/domain/fire.ts](../../src/domain/fire.ts): cel = wydatki·12/SWR, kapitalizacja miesięczna, pasma ±2 p.p. Kapitał startowy z bucketów emerytalnych+inwestycyjnych (po FX), wpłata z wolnych środków + składek. Karta na Plan → Emerytura i podatki.

## Stan / długi
- 195 testów FE zielonych, lint czysty, `compileKotlin` zielony (testy backendu z Testcontainers lecą na CI).
- Scenariusze: wyższe koszty emulowane ujemną deltą dochodu (semantyka istniejącego what-if).
- FIRE: stały realny zwrot, bez Belki — kompas, nie symulacja Monte Carlo.

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Plan → Budżet miesiąca → „Plan vs wykonanie": miesiące z zaimportowanymi wyciągami pokazują rzeczywiste przychody/wydatki obok planu z sensownymi % odchyleń (transfery własne nie zawyżają wydatków)
- [ ] Po dopisaniu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID do /opt/savings-planner/.env i restarcie compose przycisk „Wyślij testowe przypomnienie" w Ustawieniach dostarcza wiadomość na Telegram
- [ ] Majątek: panel „Propozycje sald" pokazuje konto z ingestem bez snapshota w tym miesiącu, a „Przyjmij" wpisuje saldo do tabeli (i propozycja znika)
- [ ] Ustawienia → „Pobierz aktualne kursy z NBP" wypełnia kursy EUR/USD zgodne z dzisiejszą tabelą A i net worth przelicza się natychmiast
- [ ] Plan → Cele i długi → „Zapisane scenariusze": scenariusz „dziecko +1500 zł kosztów" pokazuje późniejsze ETA celów i mniejsze wolne środki; przetrwa odświeżenie strony
- [ ] Plan → Emerytura i podatki → karta FIRE podpowiada kapitał z bucketów (nie 0, jeśli są snapshoty) i pokazuje trzy daty (pesymistycznie/bazowo/optymistycznie)
- [ ] Ten deploy przyniósł na Telegramie checklistę EPIC-16 (a nie ostrzeżenie „NO human-verify checklist")
<!-- HUMAN-VERIFY:END -->
