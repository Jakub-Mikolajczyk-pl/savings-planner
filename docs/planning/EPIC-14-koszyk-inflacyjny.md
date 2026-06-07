# EPIC 14 — Koszyk inflacyjny (własny wskaźnik CPI) — plan / handover

> Dla modelu wykonującego oraz dla Jakuba jako dokument decyzyjny. Samowystarczalny.
> Czytaj razem z `ROADMAP-2026.md` (sekcja 4 model danych, EPIC 7 „Inteligencja danych"),
> `EPIC-9-categorization-handover.md`, `EPIC-11-leak-analysis-handover.md`,
> `EPIC-8-bank-ingest.md`. Konwencja jak w pozostałych EPIC-ach: dydaktyczny Kotlin w backendzie,
> single-tenant, deterministyczny rdzeń + opcjonalny lokalny LLM tylko jako dodatek.
>
> Status: **✅ MVP WDROŻONE (local-only, T1–T7, 2026-06-07).**
> Zakres: parser .eml (Frisco + Lisek), silnik Laspeyres, slice Zustand + persist, dialog importu,
> ekran Koszyk z wykresem CPI / top movers / shrinkflacją, nakładka GUS, merge/edycja pozycji.
> Backend (14.6–14.10) pozostaje poza zakresem bieżącej iteracji.
> Szczegóły implementacyjne: `EPIC-14-koszyk-inflacyjny-handover.md`.

---

## 0. Problem w jednym zdaniu

Chcesz **własny wskaźnik inflacji** liczony na realnym, osobistym koszyku (spożywka z Frisco/Lisek,
karma + żwir z Zooplus, suplementy, leki) — a nie ogólny GUS — żeby widzieć **ile naprawdę rosną
ceny rzeczy, które faktycznie kupujesz**, które pozycje napędzają wzrost i gdzie kupować taniej.

---

## 1. Najważniejsze ustalenie: transakcje NIE wystarczą

To jest sedno pytania z brief-u („czy transakcje wystarczą czy input muszę mieć"). Odpowiedź jest
twarda i determinuje całą architekturę:

| Poziom danych | Co masz dziś | Czy nadaje się na CPI |
|---|---|---|
| **Zlecenie/transakcja** (`finance.transactions`: `amount`, `description`, `counterparty`) | TAK — z ingestu bankowego (EPIC 8) | **NIE.** Jedno zamówienie Frisco = jeden wiersz `FRISCO.PL -287,43`. Nie da się z tego wyciągnąć, że mleko podrożało z 3,49 na 4,19. |
| **Kategoria/cykl** (leak analysis EPIC 11: delta „Zakupy spożywcze" cykl-do-cyklu) | TAK | **NIE jako inflacja.** Delta kategorii miesza wzrost cen ze zmianą koszyka (raz kupiłeś więcej, raz mniej). To wskaźnik *wydatków*, nie *cen*. |
| **Pozycja / SKU** (produkt + cena jednostkowa + data) | **BRAK** | **TAK.** Tylko to pozwala policzyć indeks Laspeyresa na stałym koszyku. |

**Wniosek:** potrzebny jest **nowy poziom danych — pozycje (line items) z ceną jednostkową w czasie.**
Bank tego nigdy nie da. Źródłem muszą być platformy zakupowe (mają itemizowane zamówienia) i ręczny
input jako podłoga. To nie zastępuje transakcji — to **prostopadła** warstwa danych, dlatego zasługuje
na **własny ekran**, nie podzakładkę Transakcji.

Pozytyw: leak analysis i kategoryzacja zostają jak są (poziom wydatków). Koszyk to osobny obiektyw (poziom cen).

---

## 2. Model danych (nowy)

Jednostką nie jest transakcja, tylko **śledzony produkt (SKU)** i jego **obserwacje ceny**.

```ts
// src/domain/types.ts — dodać

export type BasketItemKind = 'food' | 'pet' | 'supplement' | 'med' | 'household' | 'other'
export type PriceSource = 'manual' | 'email' | 'extension' | 'ocr' | 'import'
export type StoreId = 'frisco' | 'lisek' | 'zooplus' | 'apteka' | 'other' | string

export interface BasketItem {
  id: string
  name: string                 // "Mleko Łaciate 3.2%"
  brand?: string
  kind: BasketItemKind
  unit: 'kg' | 'l' | 'szt' | 'opak'   // jednostka NORMALIZACJI (do ceny za kg/l)
  packageSize: number          // np. 1 (L), 0.5 (kg), 12 (szt w opak.) — do normalizacji + wykrycia shrinkflacji
  barcode?: string             // EAN — klej do quick-capture (skan) i dedupe
  defaultStore?: StoreId
  active: boolean              // czy wchodzi do bieżącego koszyka
  weight?: number              // ręczna waga w indeksie; brak => auto z udziału w wydatkach base period
}

export interface PriceObservation {
  id: string
  itemId: string
  date: string                 // "YYYY-MM-DD"
  store: StoreId
  packagePrice: number         // cena zapłacona za opakowanie (to widać na paragonie)
  quantity: number             // ile sztuk/opakowań
  unitPrice: number            // packagePrice / packageSize — cena za kg/l/szt (derived, ale persystowana dla szybkości)
  isPromo: boolean             // cena promocyjna? (do filtra "ceny regularne")
  source: PriceSource
  orderRef?: string            // nr zamówienia / fingerprint maila — dedupe
}

export interface BasketConfig {
  basePeriod: string           // "YYYY-MM" — okres bazowy indeksu (np. pierwszy pełny miesiąc danych)
  method: 'laspeyres' | 'spend_weighted'  // domyślnie laspeyres (jak GUS, porównywalne)
  excludePromo: boolean        // licz indeks na cenach regularnych
  officialCpi?: { month: string; valuePct: number }[]  // ręcznie wklejony GUS r/r do nakładki
}
```

Skala: kilkadziesiąt SKU × kilkanaście obserwacji rocznie = setki rekordów. Trywialne dla localStorage i Postgres.

### Buckety koszyka (mapują na Twoje realne zakupy)
- **food** → Frisco, Lisek (spożywka)
- **pet** → Zooplus (karma kota, żwir) — najczystsze serie: te same SKU regularnie, idealne konstytuanty
- **supplement / med** → apteka/iHerb — też stabilne SKU, dobre do śledzenia
- **household** → chemia, jak dojdzie

---

## 3. Strategia pozyskiwania danych (warstwowo, od najtańszej w utrzymaniu)

Pięć warstw. **Rekomendacja: wdrażać A→manual→email→reszta**, nie wszystko naraz.

### Warstwa 0 — Ręczny quick-input (PODŁOGA, zawsze dostępna) ✅ wdrożyć pierwszą
Każda inna metoda degraduje do tej. Mobilny-first formularz: ostatnio śledzone produkty jako
**klikalne chipy** (tap → +1), pole ceny, toggle promo, skan EAN (kamera → `BarcodeDetector` API w przeglądarce).
Kontekst ADHD (z pamięci: żona, niska tolerancja na friction) → **friction jest wrogiem nr 1**. Chipy + skan, nie formularz na 8 pól.

### Warstwa 1 — Ingest z maili potwierdzających (NAJLEPSZY ROI) ⭐ rekomendacja na automat
Frisco, Lisek **i** Zooplus wysyłają **itemizowane maile potwierdzające zamówienie** (produkt, ilość, cena).
- **Czemu najlepsze:** brak logowania automatem, brak kruchego scrapowania DOM, dane z Twojej skrzynki (RODO-bezpieczne), działa dla wszystkich trzech platform jednym wzorcem.
- **Jak:** reużyć wzorzec adapterów z EPIC 8 (`BankStatementAdapter` → analogiczny `OrderEmailAdapter` per platforma). Dwa warianty wejścia:
  - **prosty (MVP):** user kopiuje treść maila / wrzuca `.eml` → `POST /api/basket/ingest-email` → parser per nadawca → pozycje.
  - **automat (później):** poll IMAP dedykowanej skrzynki/folderu (reguła w mailu: „→ Koszyk") → backend zaciąga sam.
- **Ryzyko:** zmiana szablonu maila platformy = poprawka parsera. Niższe niż DOM scraping.

### Warstwa 2 — Wtyczka do przeglądarki (Frisco / Zooplus web, bulk historii)
Content-script na stronie historii zamówień. **Nie scrapuje DOM-u na ślepo** — przechwytuje JSON,
który SPA i tak pobiera (Frisco/Zooplus to aplikacje webowe wołające własne API), POST → backend.
- **Plus:** masowy import całej historii wstecz, działa bez maili.
- **Minus:** najwięcej roboty, najbardziej kruche (zmiana API platformy), per-platforma. **Niżej w kolejności.**
- Lisek — pomijamy w tej warstwie (mobilny-first, web szczątkowy).

### Warstwa 3 — Mobilny quick-capture dla Liska (PWA share-target)
Lisek to q-commerce mobilny — brak web/API. Dwie ścieżki:
- **PWA `share_target`:** apka instalowalna (jest w roadmapie EPIC 6.1), rejestruje się jako cel „Udostępnij".
  Z Liska/maila „udostępnij zamówienie" → ląduje w naszej PWA → prefill pozycji.
- **Fallback:** Warstwa 0 (chipy + skan) na telefonie — i tak najszybsza dla pojedynczych dokupek.

### Warstwa 4 — OCR paragonu (opcjonalne, najpóźniej)
Zdjęcie paragonu/PDF → pozycje przez **lokalny LLM z vision** (spójne z zasadą „dane nie opuszczają
maszyny", ten sam Ollama co w EPIC 9). Najcięższe, najniższy priorytet — tylko jeśli maile + manual nie wystarczą.

### Tabela decyzyjna źródeł
| Platforma | Najlepsze źródło | Backup |
|---|---|---|
| **Frisco** | mail potwierdzający / wtyczka (web ma pełne API) | manual |
| **Zooplus** | mail potwierdzający (stałe SKU karma/żwir) | wtyczka / manual |
| **Lisek** | PWA share-target / **manual chipy** | mail jeśli itemizuje |
| **Suplementy/leki** | manual (chipy, stabilne SKU) | OCR paragonu apteki |

---

## 4. Ekran „🧺 Koszyk" — design

Nowa zakładka w `src/App.tsx` (`TABS`), równoległa do Transakcji. Layout w stylu istniejących workspace'ów (Tailwind, Recharts, lucide).

```
┌─ 🧺 Koszyk inflacyjny ───────────────────────────────────────────────┐
│ [KPI] Twój CPI: +7,3% r/r   │ GUS: +4,9%  │ Wartość koszyka: 1 240 zł │
│       (base 2025-06)         │ (nakładka)   │  (+84 zł vs base)         │
├──────────────────────────────────────────────────────────────────────┤
│  [Wykres] Personal CPI w czasie ── linia Twoja vs przerywana GUS       │
│           + przełącznik: ceny regularne / z promocjami                  │
├──────────────────────────────────────────────────────────────────────┤
│  [Top movers]  (karty jak Next Best Action)                            │
│   ⬆ Karma kota Acana +18%  „rozważ zapas / zmianę"                      │
│   ⬆ Masło +14%             ⬇ Żwir Tigerino −6%                          │
├──────────────────────────────────────────────────────────────────────┤
│  [Tabela koszyka]  sort wg „największy ruch"                           │
│   Produkt        Sklep    Cena/kg  Δ base  Δ ost.zakup  sparkline  źr. │
│   Mleko Łaciate  Frisco   4,19     +20%    +0,30        ▁▂▃▅       📧   │
│   Karma Acana    Zooplus  ...                                          │
│   [+ Dodaj pozycję]   [⚡ Szybki wpis (chipy)]   [📥 Ingest maila]      │
├──────────────────────────────────────────────────────────────────────┤
│  [Drill-down po kliknięciu pozycji]                                    │
│   • Historia ceny (scatter: ● regularna ○ promo)                       │
│   • Porównanie sklepów: Frisco 4,19 │ Lisek 4,49 │ → arbitraż           │
│   • Shrinkflacja: opak. 1L→0,9L, cena ta sama = +11% efektywnie ⚠       │
└──────────────────────────────────────────────────────────────────────┘
```

Elementy szczegółowo:
- **KPI header** — Twój wskaźnik r/r, opcjonalna nakładka GUS (ręcznie wklejony z `BasketConfig.officialCpi`), wartość koszyka teraz vs base.
- **Wykres CPI** — Recharts line, Twój indeks + przerywana linia GUS, toggle promo/regularne.
- **Top movers** — deterministyczne karty (wzór `nextBestAction.ts`): które SKU najmocniej napędziły Twoją inflację + akcja (zapas/zmiana sklepu/zamiennik). Opcjonalnie lokalny LLM tylko *narratuje* uzasadnienie, nigdy nie liczy.
- **Tabela koszyka** — sortowalna (reuse wzorca `transactionSorting.ts`), sparkline per pozycja, ikona źródła (📧 mail / 🧩 wtyczka / ✍ ręcznie).
- **Drill-down** — historia ceny (promo vs regularna), **porównanie sklepów dla tego samego EAN** (arbitraż Frisco/Lisek/Zooplus), **wykrycie shrinkflacji**.
- **Akcje** — Dodaj pozycję / Szybki wpis (chipy, mobile) / Ingest maila.

---

## 5. Silnik (deterministyczny rdzeń) — `src/domain/inflationBasket.ts`

Czysty, testowalny moduł (jak `allocation.ts`, `leakAnalysis`, `nextBestAction.ts`). Pełne pokrycie Vitest.

Funkcje:
1. **`normalizeUnitPrice(obs)`** — `packagePrice / packageSize` → cena za kg/l/szt. Bez tego nie wyłapiesz **shrinkflacji** (mniejsze opakowanie, ta sama cena).
2. **`personalCpi(items, observations, config)`** — indeks **Laspeyresa** na stałych ilościach z okresu bazowego (metodologicznie zgodne z GUS → porównywalne). `spend_weighted` jako wariant alternatywny.
3. **`itemTrend(itemId)`** — Δ vs base, Δ vs ostatni zakup, sparkline points.
4. **`topMovers(n)`** — pozycje o największym wkładzie do wzrostu indeksu (waga × Δ ceny).
5. **`storeComparison(itemId)`** — najtańszy/najdroższy sklep dla SKU (arbitraż).
6. **`detectShrinkflation()`** — spadek `packageSize` przy utrzymanej `packagePrice` → wzrost ceny efektywnej.
7. Obsługa braków: carry-forward ostatniej ceny gdy brak obserwacji w okresie; filtr promo wg `config.excludePromo`.

**Zasada:** żadnego LLM w liczeniu indeksu. LLM (lokalny, EPIC 9) co najwyżej: parsowanie maili (warstwa 1) i narracja top-moverów.

---

## 6. Tryby local vs backend (zgodnie z istniejącą dual-mode)

- **Faza 1 — local-only** (jak EPIC 1/2): Zustand slice (`basketItems`, `priceObservations`, `basketConfig`) + persist do localStorage + rozszerzony export/import JSON. Ekran + silnik + ręczny input + ingest maila „przez wklejenie treści". **Zero zależności od serwera — szybka wartość.**
- **Faza 2 — backend** (gdy potrzebny automat): tabele Postgres + Flyway `V11__inflation_basket.sql`, encje JPA (dydaktyczne), REST CRUD, endpoint `POST /api/basket/ingest-email`, parsery adapterów. Potrzebny dla IMAP-polla i wtyczki (serwer jako odbiorca). Front przełącza się flagą `VITE_BACKEND` jak dziś.

Schema (Faza 2, szkic):
```sql
create table finance.basket_items ( id bigint generated always as identity primary key,
  name text not null, brand text, kind text not null, unit text not null,
  package_size numeric(10,3) not null, barcode text, default_store text,
  active boolean not null default true, weight numeric(8,4) );
create table finance.price_observations ( id bigint generated always as identity primary key,
  item_id bigint not null references finance.basket_items(id) on delete cascade,
  obs_date date not null, store text not null, package_price numeric(10,2) not null,
  quantity numeric(10,3) not null default 1, unit_price numeric(10,4) not null,
  is_promo boolean not null default false, source text not null, order_ref text,
  unique (item_id, obs_date, store, order_ref) );
create table finance.basket_config ( id int primary key default 1,
  payload jsonb not null );  -- BasketConfig 1:1 (jak mortgage_plan)
```

---

## 7. Fazowanie / chunki (PR-sized, konwencja ROADMAP §6)

> Kolejność dobrana tak, by **najpierw udowodnić ekran i matematykę indeksu przy zerowym ryzyku ingestu**, potem dokładać automatyzację od najtańszej w utrzymaniu.

**14.1 · Typy + slice + silnik (local)** · zależy: — · *Zakres:* `BasketItem`/`PriceObservation`/`BasketConfig` w `types.ts`; Zustand slice + CRUD + persist + export/import; `src/domain/inflationBasket.ts` (normalizacja, Laspeyres, trend, topMovers, shrinkflacja). *Acceptance:* testy silnika (Vitest) na fixture'ach; lint/build zielone.

**14.2 · Ekran „Koszyk" — szkielet** · zależy: 14.1 · *Zakres:* nowa zakładka w `App.tsx`; KPI header, wykres CPI (Recharts), tabela koszyka (sort), drill-down pozycji. *Acceptance:* na danych demo widać indeks, trend i porównanie sklepów.

**14.3 · Ręczny quick-input (mobile-first)** · zależy: 14.2 · *Zakres:* formularz dodawania + **chipy ostatnich produktów**, toggle promo, skan EAN (`BarcodeDetector`). *Acceptance:* dodanie obserwacji w ≤3 tapnięcia dla znanego SKU.

**14.4 · Ingest maila (wklejenie / .eml, local)** · zależy: 14.1 · *Zakres:* parser treści maila per nadawca (Frisco/Zooplus/Lisek) → pozycje; dialog „Ingest maila" (wzór `ImportCsvDialog.tsx`); dedupe po `orderRef`. *Acceptance:* wklejony mail Frisco tworzy poprawne obserwacje z ceną jednostkową.

**14.5 · Top movers + nakładka GUS** · zależy: 14.2 · *Zakres:* karty top-moverów (wzór Next Best Action), ręczne wklejenie GUS CPI do nakładki na wykresie. *Acceptance:* karty wskazują realnie największe wzrosty; linia GUS rysuje się obok Twojej.

**14.6 · Backend (Postgres + REST + email ingest)** · zależy: 14.1, infra EPIC 0 · *Zakres:* Flyway V11, encje, CRUD, `POST /api/basket/ingest-email`. Dydaktyczny Kotlin. *Acceptance:* migracja przechodzi; testy repo (Testcontainers); ingest maila przez API.

**14.7 · Automat: IMAP poll** · zależy: 14.6 · *Zakres:* poll folderu skrzynki → adaptery → upsert. *Acceptance:* mail w folderze „Koszyk" pojawia się jako obserwacje bez ręcznej akcji.

**14.8 · Wtyczka przeglądarki (Frisco/Zooplus, bulk historii)** · zależy: 14.6 · *Zakres:* content-script przechwytuje JSON historii zamówień → `POST`. *Acceptance:* import historycznych zamówień jednym kliknięciem.

**14.9 · PWA share-target (Lisek)** · zależy: 14.6, EPIC 6.1 (PWA) · *Zakres:* `share_target` w manifeście → prefill. *Acceptance:* „udostępnij" z telefonu prefilluje wpis.

**14.10 · (opcja) OCR paragonu lokalnym LLM** · zależy: 14.6 · najniższy priorytet.

**MVP = 14.1 → 14.2 → 14.3 → 14.4 → 14.5** (local-only, bez serwera). Dostarcza pełną wartość: widzisz własną inflację, top movery, arbitraż sklepów, wpisujesz ręcznie i z maili.

---

## 8. Na czym bazuję (reuse istniejącego kodu)
- **Adaptery ingestu** EPIC 8 (`BankStatementAdapter`, `AliorCsvAdapter`) → wzór dla `OrderEmailAdapter`.
- **Dual-mode + slice + persist** (`src/store/index.ts`) → identyczny wzór dla koszyka.
- **Dialog importu** (`src/components/accounts/ImportCsvDialog.tsx`) → wzór dla „Ingest maila".
- **Sortowanie tabeli** (`src/components/transactions/transactionSorting.ts`).
- **Deterministyczne karty** (`src/domain/nextBestAction.ts`) → wzór top-moverów.
- **Lokalny LLM** (EPIC 9, Ollama) → opcjonalnie parser maili + narracja, nigdy liczenie.
- **Demo data** (`scripts/make-demo-data.mjs`) → dosypać syntetyczny koszyk do screenów README.

---

## 9. Otwarte decyzje (do potwierdzenia przed startem)
1. **Metoda indeksu:** Laspeyres (stały koszyk, jak GUS, porównywalne) — proponuję jako domyślną. OK?
2. **Pierwsza warstwa automatu:** mail-ingest (warstwa 1) vs wtyczka (warstwa 2). Proponuję **mail** (tańsze, działa dla wszystkich 3 platform). OK?
3. **Promocje:** liczyć indeks na cenach regularnych czy zapłaconych? Proponuję toggle, domyślnie **regularne** (czysty sygnał cenowy), z podglądem „ile realnie płacisz".
4. **Skrzynka do IMAP-polla:** osobny alias/folder czy główna skrzynka + reguła? (faza 14.7)
5. **Zakres MVP:** czy zatwierdzasz local-only 14.1–14.5 jako pierwszą dostawę, backend później?
6. **GUS:** ręczne wklejanie wartości r/r czy próbować ciągnąć z API GUS/Eurostat? Proponuję na start ręcznie.

---

## 10. Czego TU się uczysz (gdy ruszy backend, zasada ROADMAP §3)
- Adaptery parsujące jako `sealed class` wyników (sukces/błąd szablonu) — idiom Kotlina.
- JSONB singleton dla `BasketConfig` (jak `mortgage_plan`) vs znormalizowane tabele obserwacji — kiedy co.
- IMAP w Springu (JavaMail) + idempotentny upsert po `order_ref` (ten sam wzór co fingerprint transakcji).
