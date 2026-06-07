# EPIC 14 — Koszyk inflacyjny (własny CPI z maili Frisco + Lisek) — handover implementacyjny

> Dla modelu wykonującego. **Samowystarczalny** — nie wymaga wracania do rozmowy, w której powstał.
> Czytaj razem z planem ogólnym `docs/planning/EPIC-14-koszyk-inflacyjny.md` i `ROADMAP-2026.md`
> (EPIC 7 „Inteligencja danych"). Konwencja jak w EPIC 8–13: dydaktyczne komentarze, deterministyczny
> rdzeń, **bez LLM**. Plik zatwierdzonego planu: `C:\Users\kupci\.claude\plans\c-users-kupci-downloads-twoje-zam-wieni-fizzy-wren.md`.
>
> Status: **gotowe do egzekucji.** Nic z EPIC-14 nie jest jeszcze zaimplementowane.

---

## 0. Cel w jednym zdaniu

Nowy ekran „🧺 Koszyk", który z wgranych plików `.eml` (potwierdzenia zamówień **Frisco** i **Lisek**,
historia od 2021) buduje serię cen per produkt i liczy **osobisty wskaźnik inflacji** — w całości
**po stronie przeglądarki** (tryb local), bez backendu.

## 1. Decyzje zablokowane (NIE renegocjować)

| # | Decyzja | Wartość |
|---|---|---|
| D1 | Źródło danych | **Tylko maile `.eml`** Frisco + Lisek. Bez scrapera, wtyczki, IMAP, Zooplus, OCR. |
| D2 | Ingest | User pobiera `.eml` ręcznie hurtem → **upload wielu plików**, parsowanie w przeglądarce. |
| D3 | Tożsamość produktu | **Wyłącznie po znormalizowanej nazwie** (brak pewnego EAN). EAN z URL obrazków **ignorujemy**. |
| D4 | Tryb | **Local-only** (Zustand + localStorage). Backend/Postgres/REST **poza zakresem**. |
| D5 | Indeks | **Laspeyres** (stały koszyk z okresu bazowego) jako domyślny; `spend_weighted` jako wariant. |
| D6 | Koszyk | **Hybryda**: ingest zaciąga wszystkie pozycje; do indeksu wchodzą produkty z ≥ `trackingThreshold` obserwacji (domyślnie 3) + ręczny toggle „śledź/pomiń". |
| D7 | LLM | Nie używamy nigdzie w tym EPIC-u. |

---

## 2. Kontekst kodu — punkty zaczepienia (zweryfikowane)

- **Tryb local vs API:** `src/config.ts` → `IS_API_MODE`. W local mode akcje store kończą się na `set()`
  + persist do localStorage; `runMutation` (API) jest no-op. Koszyk = czysto local, **żadnych wywołań API**.
- **Store:** `src/store/index.ts` (Zustand + `persist`). Wzorce do skopiowania 1:1:
  - `DataState` (interfejs trwałej domeny) — dodać 3 pola koszyka.
  - `emptyDataState()`, `dataSnapshot()`, `readPersistedLocalState()`, `importData()`, `partialize` —
    **każde z tych miejsc** trzeba rozszerzyć o nowe pola (inaczej koszyk nie będzie persystowany/eksportowany).
  - Wzór prostych akcji lokalnych: `addSubscription` / `updateSubscription` / `removeSubscription`.
- **ID:** `createId()` z `src/domain/id.ts`. **Miesiąc bieżący:** `currentYearMonth()` z `src/domain/formatting.ts`.
- **Parsowanie cen PL:** `parseCurrencyInput()` z `src/domain/currency.ts` — radzi sobie z `"14,59 zł"`,
  `"1 234,50 zł"` (sanitizuje śmieci, ogarnia `,` jako separator dziesiętny). **Użyć do cen z maili.**
- **Dialog importu (wzór UI/stylów, NIE logiki):** `src/components/accounts/ImportCsvDialog.tsx` —
  użyć stylów Tailwind, `FileReader`, layout modala. UWAGA: tamten dialog jest backend-bound; nasz
  parsuje **lokalnie** i woła lokalną akcję store.
- **Sort tabeli (wzór):** `src/components/transactions/transactionSorting.ts` + `SortableTransactionHeader.tsx`.
- **Karty rekomendacji (wzór dla „Top movers"):** `src/domain/nextBestAction.ts` + `src/components/plan/`.
- **Zakładki:** `src/App.tsx` — tablica `TABS` (`overview/assets/plan/transactions/settings`), `AppTab`,
  `TAB_HASH`, `tabFromHash`, render w swit/mapie. Dodać `basket`.
- **Testy:** Vitest. Wzór czystego modułu domeny + test: `src/domain/allocation.ts` + `allocation.test.ts`,
  `src/domain/nextBestAction.ts` + `.test.ts`.
- **Demo data:** `scripts/make-demo-data.mjs` (opcjonalnie dosypać syntetyczny koszyk pod README).

---

## 3. SPEC PARSOWANIA `.eml` (najważniejsza część — zweryfikowana na 4 realnych mailach)

Pliki referencyjne (u użytkownika, **z PII** — przy robieniu fixtures zanonimizować adres/numer/maile):
`C:\Users\kupci\Downloads\Twoje zamówienie jest już w drodze.eml` (Frisco 2026),
`...(1).eml` (Frisco 2021), `Zamówienie dostarczone.eml` (Lisek 2025),
`Potwierdzenie zamówienia.eml` (Lisek 2022).

### 3.1 Warstwa MIME (`eml.ts`)
1. Rozdziel **nagłówki** od **ciała** na pierwszej pustej linii (`\r\n\r\n` lub `\n\n`). Nagłówki
   mogą być zawijane (kontynuacja zaczyna się od spacji/tab — sklej z poprzednią).
2. Odczytaj: `From`, `Subject` (może być MIME-encoded `=?utf-8?...?=` — zdekoduj base64/Q),
   `Date`, `Content-Type` (+ `boundary`), `Content-Transfer-Encoding`.
3. **Frisco**: `Content-Type: text/html; charset=utf-8`, `Content-Transfer-Encoding: 8bit` →
   ciało to **surowy HTML** (bez dekodowania QP).
4. **Lisek**: `multipart/alternative; boundary=...`, części `text/plain` i `text/html`, obie
   `quoted-printable`. Rozbij po `--boundary`, weź części `text/plain` **i** `text/html`,
   **zdekoduj quoted-printable**: usuń miękkie łamania `=\r?\n`, zamień `=XX` (hex) na bajt, całość jako UTF-8.
5. Zwróć `{ headers, htmlBody, textBody? }`. HTML parsuj przez `DOMParser` (`new DOMParser().parseFromString(html, 'text/html')`).

### 3.2 Wykrywanie sklepu (`vendorDetect.ts`)
- `From` zawiera `frisco.pl` → `frisco`.
- `From` zawiera `lisek.app` → `lisek`.
- inaczej → `unknown` (adapter zwraca błąd „nieznany nadawca").

### 3.3 Adapter Frisco (`friscoAdapter.ts`)
Wejście: `htmlBody` (Document) + `headers`. **Dwa szablony** (2021 ma kolumnę VAT, 2026 nie) — parsuj
**bez polegania na indeksie kolumny** (patrz niżej), więc jeden kod obsłuży oba.

- **orderRef:** znajdź komórkę z tekstem „Numer zamówienia:" → wartość z sąsiedniej prawej `<td>`
  (np. `633555/260009`). Regex fallback na całym tekście: `Numer zamówienia:\s*([\w/]+)`.
- **date:** „Termin dostawy:" → tekst typu `poniedziałek, 01.06.2026, 11:30-12:30` → wyłuskaj `dd.mm.yyyy`
  → `YYYY-MM-DD`. Fallback: nagłówek `Date`.
- **pozycje:** iteruj po wierszach `<tr>` produktów. Markery `<!-- START PRODUCT ROW -->` znikają po
  `DOMParser` (to komentarze), więc selekcja: w tabeli z klasą `products` weź `<tr>`, w których jest
  `<td class="prodimg">`. Dla każdego takiego `<tr>` zbierz `<td>`-y i wyciągnij:
  - **name:** tekst `<td>` zaraz po `td.prodimg` (drugi td). `textContent.trim()`, scal białe znaki.
  - **priceCells:** wszystkie `<td>` z tekstem pasującym do `/\d+[ ]?\d*,\d{2}\s*zł/`. **unitPrice = pierwsza**,
    **lineTotal = ostatnia** (w 2021 między nimi jest VAT „5%", ale on nie pasuje do regexu ceny → ok).
  - **quantity:** `<td>`, którego `textContent.trim()` to czysta liczba całkowita (między name a pierwszą ceną).
  - **isWeightItem:** czy w wierszu istnieje `td.weight img` (ikona wagi). 
  - Pomiń wiersze z ceną `0,00 zł` (gratisy/worki) — albo zostaw z flagą; **decyzja: pomijać przy ingest**
    (nie wnoszą sygnału cenowego), ale to udokumentować.
  - `unitPrice` parsuj `parseCurrencyInput`. To **cena za sztukę/opakowanie** (Frisco podaje wprost).

### 3.4 Adapter Lisek (`liskAdapter.ts`)
Wejście: `htmlBody` + `textBody` + `headers`. **Dwa pod-szablony.**

- **orderRef + date:** najłatwiej z `textBody` (czysty tekst po dekodowaniu QP):
  - 2025: linie `Numer zamówienia: 4894947` i `Data: 05.10.2025 19:13:15` → `dd.mm.yyyy`.
  - 2022: `Numer zamówienia: N30-1162888` i `Dnia 22 Grudnia 2022 15:40:39` → **polski miesiąc w dopełniaczu**
    (Stycznia, Lutego, Marca, Kwietnia, Maja, Czerwca, Lipca, Sierpnia, Września, Października, Listopada,
    Grudnia) → mapa na 01..12.
  - Fallback daty: nagłówek `Date`.
- **pozycje — wykryj pod-szablon po treści HTML:**
  - **Lisek-2025** (`data-type="code"`, obrazki `im.k8s.lisek.app/resize`): wiersze `<tr>` z **4 `<td>`**:
    [img] · [nazwa] · [`"N szt."`] · [cena = **SUMA linii**, np. `9,98 zł`]. 
    `quantity` = liczba z `"N szt."`; `unitPrice = lineTotal / quantity` (zaokrąglij do grosza).
  - **Lisek-2022** (układ „Koszyk", komórki z `<strong>N x</strong>`): wiersze `<tr>` z 3 `<td>`:
    [`<strong>4 x</strong>`] · [nazwa] · [cena = **SUMA linii**, np. `35,96 zł`].
    `quantity` = liczba z `"N x"`; `unitPrice = lineTotal / quantity`.
  - W obu: nazwa z `textContent.trim()`, cena przez `parseCurrencyInput`. `isWeightItem = false` (Lisek nie waży).
- **Uwaga:** część kwotowa w Lisku to **suma**, nie cena jednostkowa (odwrotnie niż Frisco) — to częsty
  błąd, napisz test pilnujący `unitPrice = total/qty`.

### 3.5 Wynik adaptera (sealed-style)
```ts
type ParsedLine = { rawName: string; quantity: number; unitPrice: number; lineTotal: number; isWeightItem: boolean }
type ParsedOrder =
  | { ok: true; store: StoreId; orderRef: string; date: string; lines: ParsedLine[] }
  | { ok: false; reason: 'unknown_vendor' | 'unknown_template' | 'no_items' | 'parse_error'; detail?: string }
```
Dialog importu agreguje wyniki: liczba plików OK / błędnych (z powodem), zamówień, pozycji, nowych
produktów, zdedupowanych obserwacji.

### 3.6 Normalizacja nazwy (`nameNormalize.ts`) — wspólna
- **packageSize + unit:** regex globalny `/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|szt)\b/gi`, **weź OSTATNIE
  dopasowanie** (nazwy bywają „...(400g-600g) 500g", „...tacka 600g" → ostatni token jest właściwy).
  Zamień `,`→`.` w liczbie. Brak dopasowania → `unit: 'szt'`, `packageSize: undefined`.
- **brand (best-effort, opcjonalny):** wiodące tokeny pisane WIELKIMI literami (dozwolone polskie znaki,
  `&`, `!`, cyfry) aż do pierwszego tokenu z małą literą. Np. „SOKOŁÓW…", „FRISCO FRESH…", „DAN CAKE…",
  „SANTE GO ON!…". Dla Liska nazwy nie są brandowane wielkimi literami → brand pusty (ok).
- **normalizedName (klucz dedupe):** z `rawName` zdejmij token rozmiaru, lowercase, usuń interpunkcję
  (zostaw litery/cyfry/spacje, polskie znaki), scal wielokrotne spacje, trim. Przykład:
  „PIĄTNICA Serek wiejski bez laktozy 200g" → `piątnica serek wiejski bez laktozy`. Ten sam produkt
  z Frisco 2021 i 2026 ma identyczny klucz → scala się automatycznie. Rozjazdy („(kulka)", „3-4szt."
  vs „3-4 szt.") domyka ręczny merge (Task T7).

---

## 4. Model danych (`src/domain/types.ts` — dodać)

```ts
export type BasketItemKind = 'food' | 'household' | 'pet' | 'supplement' | 'other'
export type StoreId = 'frisco' | 'lisek'

export interface BasketItem {
  id: string
  normalizedName: string        // klucz dedupe
  displayName: string           // ostatnia ładna nazwa z maila
  brand?: string
  unit: 'g' | 'kg' | 'ml' | 'l' | 'szt'
  packageSize?: number          // wyparsowane z nazwy; brak => undefined
  kind: BasketItemKind          // heurystyka kind: domyślnie 'food'; 'household' dla chemii/papieru (opcjonalnie później)
  tracked: boolean              // czy w indeksie (auto: ≥ trackingThreshold obserwacji; + ręczny toggle)
  trackedManual?: boolean       // ręczne nadpisanie auto-trackingu (true/false), brak => auto
  aliases: string[]             // normalizedName-y scalone ręcznie
}

export interface PriceObservation {
  id: string
  itemId: string
  date: string                  // "YYYY-MM-DD"
  store: StoreId
  unitPrice: number             // cena za szt./opak. (Frisco: wprost; Lisek: total/qty)
  normalizedUnitPrice?: number  // zł za kg|l gdy packageSize+unit pozwala (do shrinkflacji); inaczej undefined
  quantity: number
  isWeightItem: boolean
  orderRef: string              // do dedupe importu (orderRef+itemId unikalne)
  source: 'email'
}

export interface BasketConfig {
  basePeriod?: string                    // "YYYY-MM"; brak => engine bierze najwcześniejszy miesiąc danych
  method: 'laspeyres' | 'spend_weighted' // domyślnie 'laspeyres'
  trackingThreshold: number              // domyślnie 3
  excludeWeightItems: boolean            // domyślnie true (ceny ważone bywają zmienne) — konfigurowalne
  officialCpi?: { month: string; valuePct: number }[]  // ręczny GUS do nakładki na wykres
}
```

`defaultBasketConfig: BasketConfig = { method: 'laspeyres', trackingThreshold: 3, excludeWeightItems: true }`.

**Normalizacja zł/kg:** jeśli `unit==='g'` → `zł/kg = unitPrice/(packageSize/1000)`; `'kg'` → `unitPrice/packageSize`;
`'ml'` → `zł/l = unitPrice/(packageSize/1000)`; `'l'` → `unitPrice/packageSize`; `'szt'` → brak (undefined).

---

## 5. Silnik indeksu (`src/domain/basket/inflationBasket.ts`) — czysty, testowalny

Funkcje (sygnatury orientacyjne):
- `ingestOrders(orders: ParsedOrder[], existing: {items, observations}) → {items, observations, stats}`:
  upsert `BasketItem` po `normalizedName` (lub po `aliases`); aktualizuj `displayName` na najnowszy; dodaj
  `PriceObservation` z dedupe po (`orderRef`,`itemId`); policz `normalizedUnitPrice`. `stats`:
  `{ ordersParsed, itemsNew, observationsAdded, observationsDuplicate }`.
- `monthOf(date) → "YYYY-MM"`.
- `personalCpiSeries(items, observations, config) → { month: string; index: number; valuePct: number }[]`:
  **Laspeyres price-relative.** Koszyk bazowy = produkty `tracked` z obserwacją w `basePeriod`
  (jeśli `basePeriod` brak → najwcześniejszy miesiąc z danymi). `q0_i` = suma `quantity` produktu i w
  base period. Dla miesiąca t: `index_t = Σ_i p_{t,i}·q0_i / Σ_i p_{0,i}·q0_i`, gdzie `p_{t,i}` =
  średnia (lub ostatnia) cena jednostkowa produktu i w miesiącu t; **carry-forward** ostatniej znanej
  ceny gdy brak obserwacji w t. `valuePct = (index_t - 1)*100`. `spend_weighted` = wagi z udziału
  wydatków (Σ unitPrice·quantity) zamiast q0. Respektuj `excludeWeightItems`.
- `itemTrend(itemId, observations) → { points: {date, unitPrice}[]; deltaVsBasePct?; deltaVsLastBuyPct? }`.
- `topMovers(items, observations, config, n) → { itemId, displayName, contributionPct, priceChangePct }[]`
  — sortuj po wkładzie do wzrostu indeksu (waga · Δ ceny).
- `detectShrinkflation(items, observations) → { itemId, fromSize, toSize, effectivePriceChangePct }[]`
  — spadek `packageSize` przy ~utrzymanej cenie opakowania (na produktach o tym samym `normalizedName`,
  różnym packageSize).
- `cpiYoY(series) → number | undefined` — najnowszy miesiąc vs 12 mies. wcześniej.

**Bez LLM, bez `Intl`** (patrz `currency.ts` — ICU bywa ułomne w CI). Pełne testy Vitest.

---

## 6. Rozbicie na taski (PR-sized, sekwencyjnie; T1→T2 to fundament)

> Format: **ID · tytuł · zależy · zakres · DoD · seed**. Każdy task = jeden commit/PR.

### T1 · Parser `.eml` + adaptery + normalizacja nazw
**zależy:** — · **zakres:** `src/domain/basket/{eml.ts, vendorDetect.ts, friscoAdapter.ts, liskAdapter.ts,
nameNormalize.ts}` wg §3; typy `ParsedOrder/ParsedLine` + `StoreId` w `types.ts`. Fixtures: skopiuj 4 maile
do `src/domain/basket/__fixtures__/` (zanonimizuj adres dostawy, e-mail, numer zamówienia — zostaw strukturę).
**DoD:** testy parsują 4 fixture'y: Frisco-2026 (≈37 poz., unitPrice z kolumny CENA, flaga wagi na
„Marchew luz"/„Cebula"), Frisco-2021 (z VAT, unitPrice poprawne mimo kolumny VAT), Lisek-2025
(unitPrice=total/qty, „Fanta Exotic 330ml" 2 szt → 4,99/szt), Lisek-2022 (układ `N x`, „Natura sok 4 x"
→ unit 8,99). `nameNormalize`: „...500g"/„(400g-600g) 500g" → size 500g; ten sam serek z 2021 i 2026 ma
równy `normalizedName`. `npm test` zielony. **seed:** „Zaimplementuj parser .eml i adaptery Frisco/Lisek wg
§3 handovera EPIC-14; oprzyj testy na 4 fixture'ach w __fixtures__."

### T2 · Silnik indeksu `inflationBasket.ts`
**zależy:** T1 · **zakres:** §5 (ingest+dedupe, normalizacja zł/kg, Laspeyres, trend, topMovers,
shrinkflacja, cpiYoY). **DoD:** testy: ręcznie policzony Laspeyres na 2-produktowym przykładzie; dedupe po
orderRef nie dubluje; carry-forward działa; shrinkflacja wykryta na sztucznym przypadku (1l→0,9l, ta sama
cena → +11%). **seed:** „Zaimplementuj deterministyczny silnik koszyka wg §5; bez LLM i Intl; pełne testy."

### T3 · Typy domeny + slice Zustand + persist + export/import
**zależy:** T1 · **zakres:** `BasketItem/PriceObservation/BasketConfig` + `defaultBasketConfig` w `types.ts`;
w `src/store/index.ts` dodać do **`DataState`, `emptyDataState`, `dataSnapshot`, `readPersistedLocalState`,
`importData`, `partialize`** pola `basketItems`, `priceObservations`, `basketConfig`; akcje:
`importBasketEmails(files: File[]) => Promise<ImportSummary>` (czyta pliki przez FileReader/`text()`,
woła parser+`ingestOrders`, `set()`), `setBasketConfig(patch)`, `setItemTracked(id, tracked|null)`
(null=auto), `mergeBasketItems(targetId, sourceId)`, `removeBasketItem(id)`. Wszystko **lokalnie** (bez API).
**DoD:** test slice'a (ingest 2 zamówień → produkty+obserwacje; merge; toggle; export→import round-trip
zachowuje koszyk). lint/build zielone. **seed:** „Dodaj slice koszyka do store wg §2/§4; pamiętaj o
WSZYSTKICH miejscach DataState (partialize, importData, readPersistedLocalState...)."

### T4 · Dialog importu `.eml` (bulk)
**zależy:** T3 · **zakres:** `src/components/basket/ImportEmailsDialog.tsx` na wzór
`ImportCsvDialog.tsx` (style/modal), ale: `input[type=file]` `multiple accept=".eml,message/rfc822"`,
parsowanie **lokalne** przez `importBasketEmails`, ekran podsumowania (OK/błędne z powodem, zamówienia,
pozycje, nowe produkty, duplikaty). **DoD:** wrzucenie 4 maili pokazuje 4 zamówienia, 0 duplikatów,
sensowną liczbę pozycji; ponowny import tych samych plików → wszystkie obserwacje jako duplikaty.
**seed:** „Zrób dialog bulk-importu .eml (parsowanie w przeglądarce) wg §6/T4."

### T5 · Ekran „Koszyk" + zakładka
**zależy:** T2, T3 · **zakres:** `src/components/basket/BasketPage.tsx` (+ pod-komponenty) i wpięcie w
`src/App.tsx` (`TABS`, `AppTab`, `TAB_HASH`, `tabFromHash`, render). Elementy: KPI (CPI r/r, wartość
koszyka vs base), wykres CPI (Recharts line), tabela koszyka (sort wg §2-wzór; kolumny: produkt, sklep,
cena/opak., cena/kg, Δ base, Δ ost., sparkline, #obs, toggle „śledź", ikona ⚖ dla wagi), drill-down
pozycji (historia ceny scatter + lista zamówień źródłowych), karty „Top movers". Przycisk otwierający
dialog z T4. **DoD:** na danych z 4 maili: tabela pokazuje produkty z ceną/kg, wykres się rysuje,
drill-down „PIĄTNICA Serek wiejski bez laktozy 200g" pokazuje punkty z 2021 i 2026. lint/build zielone.
**seed:** „Zbuduj ekran Koszyk wg §6/T5, reużyj wzorów sort/karty; dodaj zakładkę w App.tsx."

### T6 · Nakładka GUS + konfiguracja indeksu
**zależy:** T5 · **zakres:** UI do ręcznego wpisania `officialCpi` (miesiąc + % r/r) i ustawień
`BasketConfig` (basePeriod, method, trackingThreshold, excludeWeightItems); linia GUS (przerywana) na
wykresie CPI. **DoD:** wpisany GUS rysuje się obok Twojej linii; zmiana progu zmienia zbiór tracked.
**seed:** „Dodaj nakładkę GUS i panel konfiguracji indeksu wg §6/T6."

### T7 · Ręczny merge pozycji + edycja jednostki/rozmiaru
**zależy:** T5 · **zakres:** UI scalania dwóch `BasketItem` (źródło→cel: przepnij obserwacje, dopisz
`normalizedName` źródła do `aliases` celu) i edycji `unit`/`packageSize`/`kind`/`displayName`.
**DoD:** scalenie „Mozzarella (kulka)" z „Mozzarella" łączy historie; obserwacje nie giną. **seed:**
„Dodaj merge i edycję pozycji koszyka wg §6/T7."

### T8 · Dokumentacja + (opcjonalnie) demo data
**zależy:** T5 · **zakres:** zaktualizuj `docs/planning/EPIC-14-koszyk-inflacyjny.md` i `README.md`
(sekcja o zakładce Koszyk: email-only, local, name-based); opcjonalnie dosyp syntetyczny koszyk w
`scripts/make-demo-data.mjs` pod screeny. **DoD:** README opisuje feature; demo-data ładuje koszyk.
**seed:** „Zaktualizuj README/EPIC-14 i (opcjonalnie) demo-data o koszyk inflacyjny."

**MVP = T1→T5.** T6–T8 to domknięcie. (Jeśli używacie Todoist „AI Workbench" — załóż 8 tasków z tych ID.)

---

## 7. Pułapki (z analizy realnych maili)
- **Lisek: cena = SUMA linii**, nie jednostkowa → `unitPrice = total/qty`. Frisco odwrotnie.
- **Dwa szablony per sklep** — wykrywaj z treści, nie z daty. Frisco: kolumna VAT obecna/nieobecna →
  parsuj po regexie ceny, nie po indeksie kolumny. Lisek: `data-type="code"`+`"N szt."` (2025) vs
  `<strong>N x</strong>` (2022).
- **Quoted-printable tylko w Lisku** (8bit w Frisco). Dekoduj `=\n` (miękkie) i `=XX`.
- **Subject MIME-encoded** (`=?utf-8?b?...?=`) — dekoduj zanim użyjesz.
- **Polskie miesiące w dopełniaczu** w Lisek-2022 („22 Grudnia 2022").
- **Pozycje 0,00 zł** w Frisco (worki, gratisy) — pomijać przy ingest.
- **Frisco produkty na wagę** (`td.weight img`) — cena bywa zmienna; domyślnie `excludeWeightItems:true`
  w indeksie, ale obserwacje i tak zapisuj (z flagą).
- **Rozjazdy nazw** (interpunkcja, „(kulka)", „3-4szt." vs „3-4 szt.") — auto-merge po `normalizedName`
  nie złapie wszystkiego; domyka T7 (ręczny merge). To akceptowalne.
- **PII w fixture'ach** — anonimizuj adres/e-mail/numer zamówienia.

## 8. Weryfikacja end-to-end
1. `npm test` (adaptery na 4 fixture'ach + silnik), `npm run lint`, `npm run build` — zielone.
2. `npm run dev` → zakładka Koszyk → Import `.eml` → wrzuć 4 maile → podsumowanie (4 zamówienia, 0 dup) →
   tabela z ceną/kg, wykres CPI, drill-down powtarzalnego produktu (serek 2021 vs 2026).
3. Odśwież stronę → dane zostają (persist). Export JSON → Import JSON → koszyk odtworzony.
4. Ponowny import tych samych 4 plików → 0 nowych obserwacji (dedupe po orderRef).

## 9. Pliki
- **Nowe:** `src/domain/basket/{eml,vendorDetect,friscoAdapter,liskAdapter,nameNormalize,inflationBasket}.ts`
  + `*.test.ts`; `src/domain/basket/__fixtures__/*.eml` (4, zanonimizowane);
  `src/components/basket/{BasketPage,ImportEmailsDialog,...}.tsx`.
- **Edytowane:** `src/domain/types.ts`, `src/store/index.ts`, `src/App.tsx`,
  `docs/planning/EPIC-14-koszyk-inflacyjny.md`, `README.md`.
