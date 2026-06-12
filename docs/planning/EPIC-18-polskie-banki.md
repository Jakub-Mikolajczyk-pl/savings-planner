# EPIC 18 — Polskie banki jako produkt (F1) — plan wykonawczy

> Dla modelu wykonującego. Samowystarczalny — ale przeczytaj NAJPIERW
> `docs/planning/RELEASE-2026.md` (D4, D5) i ten dokument w całości przed pierwszym chunkiem.
> Cel fazy: **realny wyciąg z mBanku/ING/PKO importuje się bezbłędnie i ≥80% transakcji
> dostaje kategorię regułami (przed LLM); pokrycie banków jest publiczne i rozszerzalne
> przez społeczność.** Wersja na koniec: `v1.2.0` = publiczny launch PL.

## Stan wejściowy (zweryfikowane — buduj na tym, nie od zera)

Pakiet `backend/src/main/kotlin/pl/jakubmikolajczyk/savings/ingest/`:

- **`BankStatementAdapter.kt`** — kontrakt, który implementuje każdy bank:

  ```kotlin
  data class CanonicalTx(
      val bookedAt: LocalDate,
      val amount: BigDecimal,
      val currency: String,
      val description: String,
      val counterparty: String?,
      val raw: Map<String, Any?>,
  )
  enum class BankSource(val sourceValue: String) {
      ALIOR_CSV("alior_csv"),
      VELO_PDF("velo_pdf"),
  }
  interface BankStatementAdapter {
      fun supports(bank: BankSource): Boolean
      fun parse(input: InputStream): List<CanonicalTx>
  }
  ```

- **`AliorCsvAdapter.kt`** — WZORZEC nowych adapterów (~100 linii): szuka wiersza
  nagłówka po znanych kolumnach, mapuje `headers→values` do `Map`, ma własny
  odporny `parseCsvLine` (separator `;`, cudzysłowy z escapowaniem `""`), helpery
  `required`/`firstPresent`. Przeczytaj go W CAŁOŚCI zanim napiszesz nowy adapter.
- **`MoneyParser.kt`** — parsowanie kwot PL/US (`1 234,56`, `1,234.56`); reuse, nie pisz własnego.
- **`IngestService.kt`** — pętla `adapter.parse → fingerprint → insertIgnoreDuplicate`;
  fingerprint = `sha256(booked_at|amount|norm(description)|account_id)`, dedup przez
  `ON CONFLICT DO NOTHING`. **Dodanie banku NIE wymaga zmian w IngestService** —
  Spring wstrzykuje listę adapterów, wybór po `supports(bank)`.
- **`IngestController.kt`** — `POST /api/ingest` (multipart: `bank`, `accountId`, `file`).
- **`InternalTransferDetector.kt`** — oznacza przelewy własne (NRB z `INTERNAL_TRANSFER_SOURCE_ACCOUNTS`).
- Kategoryzacja: `categorization/RuleEngine.kt` (match_field `description|counterparty`,
  match_type `contains|regex`, `priority` rosnąco, pierwsze trafienie wygrywa; reguły
  w tabeli `finance.category_rules`, `source: manual|seed|llm`), `CategorizationService`,
  `OllamaLlmCategorySuggester` (lokalny Ollama, `LLM_ENABLED=false` domyślnie,
  werdykt LLM materializuje się jako reguła). Precedencja: **override usera > reguły > LLM**.
- Front: `src/components/ingest/IngestSection.tsx` (upload), widoki transakcji w
  `src/components/transactions/`, kategorie/reguły w `src/components/categorization/`.
- Migracje Flyway: `backend/src/main/resources/db/migration/` — **przed dodaniem migracji
  sprawdź najwyższy istniejący numer `V*` i weź następny** (EPIC-y 8–16 dodawały swoje).
- Testy backendu: unit bez bazy (`MoneyParserTest`, wzorce w `backend/src/test/`),
  Testcontainers dla repo/kontrolerów. Fixtures kładź w
  `backend/src/test/resources/fixtures/<bank>/` i czytaj przez classpath.

Konwencje: Kotlin dydaktyczny (komentarze INTERVIEW Q — patrz `SecurityConfig.kt`),
branch per chunk `feat/epic-18-<slug>`, PR z sekcją „Czego się tu uczysz".

Kolejność: **18.1 BLOKUJE 18.2–18.4** (fixture-first!). 18.5–18.8 po pierwszym adapterze.
18.9 na końcu.

---

## Zasada nadrzędna: FIXTURE-FIRST

Formaty eksportów bankowych zmieniają się bez zapowiedzi i różnią się między
kanałami (web vs aplikacja) i typami kont. Dlatego:

1. **Najpierw** zdobywamy świeży, realny eksport i utrwalamy jego STRUKTURĘ jako
   syntetyczny fixture (18.1).
2. **Dopiero potem** piszemy parser POD FIXTURE (18.2–18.4). Parser, który nie przechodzi
   na fixture, nie istnieje.
3. Specyfikacje formatów niżej to **oczekiwany kształt do weryfikacji**, nie prawda
   objawiona. Jeśli fixture przeczy temu dokumentowi — wygrywa fixture, a ten dokument
   poprawiasz w tym samym PR.

---

## 18.1 · Fixtures syntetyczne mBank/ING/PKO · zależy: — · **WSPÓŁPRACA: Jakub dostarcza strukturę**

**Zakres:**
1. Jakub eksportuje świeży wyciąg ze SWOJEGO mBanku (CSV, pełny miesiąc, kanał www).
   ING/PKO: struktura od znajomych (sam nagłówek + 2–3 wiersze zanonimizowane ręcznie
   przez właściciela konta!) albo czekamy na pierwsze `bank_format_request` issues —
   wtedy 18.3/18.4 schodzą na „po launchu", a launch idzie z mBank+Alior+Velo. **To
   jest akceptowalne** (D4: jakość > ilość); nie zgaduj formatów z internetu.
2. Anonimizacja → syntetyczny fixture. **Zachowujesz bajt w bajt:** kodowanie, BOM,
   separator, cudzysłowy, kolejność kolumn, preambułę/stopkę, format dat i kwot
   (w tym spacje niełamliwe!), puste pola. **Podmieniasz wartości:**
   - kwoty → inne, ale z tą samą pisownią (jeśli było `-1 234,56` z NBSP, ma być
     inne `-X XXX,XX` z NBSP),
   - nazwiska/nazwy → `JAN KOWALSKI`, `FIRMA PRZYKLADOWA SP. Z O.O.`,
   - NRB/IBAN → fikcyjne 26-cyfrowe (np. zaczynające się od `00 0000`),
   - adresy → `UL. PRZYKLADOWA 1, 00-001 WARSZAWA`,
   - tytuły przelewów → generyczne, ale ZRÓŻNICOWANE (mają zawierać typowych
     merchantów do testów 18.5: `ZABKA Z5512 K.1 WARSZAWA`, `BIEDRONKA 1234`,
     `BLIK P2P PRZELEW`, `ALLEGRO.PL`, `PRZELEWY24`, `INPOST`, abonament typu `NETFLIX`).
3. Checklist anonimizacji (wykonuje człowiek, agent NIE dotyka realnego pliku):
   - [ ] zero realnych kwot, nazwisk, NRB, adresów, numerów kart (grep po fragmentach!),
   - [ ] liczba wierszy 15–30 (różne typy: przelew przych./wych., karta, BLIK, prowizja),
   - [ ] minimum 1 przelew własny (do testu InternalTransferDetector),
   - [ ] plik otwiera się i wygląda identycznie strukturalnie jak oryginał.
4. Pliki: `backend/src/test/resources/fixtures/mbank/operacje.csv` (+ analogicznie
   `ing/`, `pko/` gdy będą). Do PR dołącz notatkę „czym ten format się różni od
   założeń z EPIC-18" i zaktualizuj sekcje 18.2–18.4.

**Acceptance:** fixture w repo; checklist anonimizacji odhaczony w PR; sekcja formatu
w tym dokumencie zaktualizowana o stan faktyczny.

---

## 18.2 · MBankCsvAdapter · zależy: 18.1 (fixture mBank)

**Oczekiwany kształt mBank CSV (ZWERYFIKUJ FIXTURE'EM):** kodowanie **Windows-1250**
(nie UTF-8!), separator `;`, kilkanaście linii preambuły (dane klienta, okres,
`#Saldo początkowe;`), wiersz nagłówka zaczynający się od `#Data operacji;`
(kolumny w stylu `#Data operacji;#Data księgowania;#Opis operacji;#Tytuł;
#Nadawca/Odbiorca;#Numer konta;#Kwota;#Saldo po operacji;`), stopka z podsumowaniem.
Kwoty potrafią mieć **NBSP (U+00A0)** jako separator tysięcy i sufiks waluty.

**Zakres:**
1. **Refactor wspólnego CSV (osobny commit w tym samym PR):** wynieś `parseCsvLine`
   z `AliorCsvAdapter` do nowego `ingest/CsvSupport.kt`:

   ```kotlin
   object CsvSupport {
       /** Parser linii CSV odporny na cudzysłowy i "" — przeniesiony 1:1 z AliorCsvAdapter. */
       fun parseLine(line: String, delimiter: Char = ';'): List<String> { /* move, nie kopiuj */ }

       /**
        * Dekodowanie pliku bankowego: UTF-8 BOM → UTF-8; w przeciwnym razie próba
        * ścisłego UTF-8; jeśli MalformedInput → Windows-1250 (polskie banki).
        * INTERVIEW Q: "Czemu nie String(bytes, UTF_8) wprost?"
        * A: Konstruktor String podmienia błędne sekwencje na U+FFFD zamiast rzucić —
        *    ścisły CharsetDecoder pozwala wykryć, że to NIE jest UTF-8 i wybrać CP1250.
        */
       fun decode(bytes: ByteArray): String {
           if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte())
               return String(bytes, 3, bytes.size - 3, Charsets.UTF_8)
           return try {
               Charsets.UTF_8.newDecoder()
                   .onMalformedInput(CodingErrorAction.REPORT)
                   .onUnmappableCharacter(CodingErrorAction.REPORT)
                   .decode(ByteBuffer.wrap(bytes)).toString()
           } catch (e: CharacterCodingException) {
               String(bytes, charset("windows-1250"))
           }
       }
   }
   ```

   `AliorCsvAdapter` przechodzi na `CsvSupport.parseLine` (testy Aliora MUSZĄ zostać
   zielone — to jest test poprawności refactoru).
2. `BankSource`: dodaj `MBANK_CSV("mbank_csv")`.
3. `MBankCsvAdapter.kt` (`@Component`, wzorzec Aliora): znajdź nagłówek po
   `#Data operacji`, parsuj wiersze do pierwszej pustej linii/stopki; mapowanie:
   `#Data operacji` → `bookedAt`; `#Kwota` → `amount` (przed `MoneyParser.parseAmount`
   usuń NBSP i sufiks waluty: `raw.replace(' ', ' ').removeSuffix(" PLN")` —
   albo lepiej: rozszerz MoneyParser o NBSP w osobnym commicie z testem);
   `#Opis operacji` + `#Tytuł` → `description` (połącz przez ` | ` gdy oba niepuste);
   `#Nadawca/Odbiorca` → `counterparty`; pełny wiersz → `raw`. Waluta: z kolumny jeśli
   jest, inaczej `PLN`.
4. Testy unit (bez bazy, wzór `AliorCsvAdapter` testy + `MoneyParserTest`):
   fixture przez classpath, asercje: liczba transakcji, konkretna kwota ujemna z NBSP,
   data, counterparty, polskie znaki w opisie (dowód, że CP1250 zadziałało).
5. Front: dodaj opcję mBank w selektorze banku w `IngestSection.tsx`
   (grep po `ALIOR_CSV` w `src/` pokaże wszystkie miejsca do rozszerzenia — typy
   lustrzane frontu też).

**Pułapki:** NIE czytaj pliku przez `BufferedReader(InputStreamReader(input, UTF_8))`
jak Alior — najpierw `input.readBytes()` → `CsvSupport.decode` (inaczej CP1250 cicho
zamieni się w krzaki i testy polskich znaków nie wykryją problemu, bo fixture też
będzie krzaczył). Stopka mBanku potrafi mieć linie z `;` — parsuj tylko między
nagłówkiem a pierwszą linią niepasującą do liczby kolumn.

**Acceptance:** testy fixture zielone; testy Aliora zielone po refactorze; ręczny
import realnego pliku mBank przez Jakuba: 100% wierszy wczytane, suma kwot zgodna
z saldem okresu w banku; ponowny import = `inserted: 0` (fingerprint dedup działa).

**Seed prompt:** „Przeczytaj `docs/planning/EPIC-18-polskie-banki.md` §Stan wejściowy
i §18.2, oraz `AliorCsvAdapter.kt`, `MoneyParser.kt`, `IngestService.kt`. Wykonaj:
refactor CsvSupport (move parseCsvLine + decode z fallbackiem CP1250), enum MBANK_CSV,
MBankCsvAdapter pod fixture `fixtures/mbank/operacje.csv`, testy unit, opcja w
IngestSection. Kotlin dydaktyczny. Branch `feat/epic-18-mbank-csv`."

---

## 18.3 · IngCsvAdapter · zależy: 18.1 (fixture ING), 18.2 (CsvSupport)

**Oczekiwany kształt (ZWERYFIKUJ FIXTURE'EM):** „Lista transakcji" CSV, separator `;`,
pola w cudzysłowach, preambuła z danymi konta, nagłówek zawiera `Data transakcji`,
`Dane kontrahenta`, `Tytuł`, `Kwota transakcji (waluta rachunku)`, `Waluta`; kodowanie
CP1250 **lub** UTF-8 z BOM (ING bywał niekonsekwentny między kanałami — `CsvSupport.decode`
obsługuje oba bez dodatkowej pracy).

**Zakres:** enum `ING_CSV("ing_csv")` + `IngCsvAdapter` (wzorzec jak 18.2, mapowanie:
`Data transakcji`→bookedAt, `Kwota transakcji (waluta rachunku)`→amount,
`Waluta`→currency, `Tytuł`→description, `Dane kontrahenta`→counterparty) + testy
fixture + opcja na froncie. ING listuje czasem operacje nieksięgowane bez daty
księgowania — wiersze bez parsowalnej daty pomijaj (`mapNotNull`), policz je
(wynik 18.8 to raportuje).

**Acceptance:** jak 18.2 (testy fixture, dedup, znaki PL), realny import gdy będzie
ochotnik z kontem ING.

---

## 18.4 · PkoCsvAdapter · zależy: 18.1 (fixture PKO), 18.2 (CsvSupport)

**Oczekiwany kształt (ZWERYFIKUJ FIXTURE'EM):** iPKO eksport CSV: separator **przecinek**,
wszystkie pola w cudzysłowach, nagłówek w stylu `"Data operacji","Data waluty",
"Typ transakcji","Kwota","Waluta","Saldo po operacji","Opis transakcji"` + dodatkowe
kolumny opisowe; daty ISO `yyyy-MM-dd`; kodowanie CP1250 lub UTF-8.

**Zakres:** enum `PKO_CSV("pko_csv")` + adapter (`CsvSupport.parseLine(line, delimiter = ',')`
— delimiter jest parametrem właśnie po to) + testy + front. Counterparty w PKO bywa
sklejone w kolumnach opisowych (`Nazwa nadawcy/odbiorcy` w dodatkowych polach) —
mapuj `firstPresentOrNull` po kandydatach, fallback null (RuleEngine może matchować
po description).

**Acceptance:** jak 18.2.

---

## 18.5 · Słownik merchantów PL (reguły seed) · zależy: 18.2 (pierwszy adapter), żeby było na czym testować

**Decyzja:** merchanci to DANE, nie kod. Plik
`backend/src/main/resources/categorization/merchant-seed.csv` w formacie
`pattern;match_field;category_name;category_kind` ładowany przy starcie **idempotentnym
upsertem** do `finance.category_rules` z `source='seed'` (dedup po
`match_field+match_type+pattern` — wymóg z EPIC-9 §9.4 już obowiązuje dla reguł LLM,
reuse tej samej ścieżki). Kategorie z pliku, których nie ma w `finance.categories`,
tworzysz (po nazwie, `kind` z pliku).
**Odrzucone:** normalizacja merchanta PRZED RuleEngine (zmienia semantykę istniejących
reguł i fingerprintów — za inwazyjne); Flyway seed (dane domenowe w migracji = ból
przy edycji).

**Startowy zestaw (~40 wpisów, rozszerzaj przy każdym imporcie):**

```csv
pattern;match_field;category_name;category_kind
zabka;description;Spożywcze;variable
biedronka;description;Spożywcze;variable
lidl;description;Spożywcze;variable
kaufland;description;Spożywcze;variable
auchan;description;Spożywcze;variable
carrefour;description;Spożywcze;variable
dino;description;Spożywcze;variable
stokrotka;description;Spożywcze;variable
frisco;description;Spożywcze;variable
lisek.app;description;Spożywcze;variable
mcdonald;description;Jedzenie na mieście;variable
kfc;description;Jedzenie na mieście;variable
pyszne.pl;description;Jedzenie na mieście;variable
glovo;description;Jedzenie na mieście;variable
uber eats;description;Jedzenie na mieście;variable
allegro;description;Zakupy online;variable
amazon;description;Zakupy online;variable
temu;description;Zakupy online;variable
empik;description;Zakupy online;variable
media expert;description;Elektronika;variable
rtv euro agd;description;Elektronika;variable
x-kom;description;Elektronika;variable
inpost;description;Przesyłki;variable
poczta polska;description;Przesyłki;variable
orlen;description;Paliwo;variable
bp ;description;Paliwo;variable
shell;description;Paliwo;variable
moya;description;Paliwo;variable
uber;description;Transport;variable
bolt;description;Transport;variable
jakdojade;description;Transport;variable
koleo;description;Transport;variable
intercity;description;Transport;variable
rossmann;description;Drogeria/zdrowie;variable
hebe;description;Drogeria/zdrowie;variable
super-pharm;description;Drogeria/zdrowie;variable
apteka;description;Drogeria/zdrowie;variable
netflix;description;Subskrypcje;recurring
spotify;description;Subskrypcje;recurring
youtube;description;Subskrypcje;recurring
hbo;description;Subskrypcje;recurring
disney;description;Subskrypcje;recurring
play.pl;description;Telekom;recurring
orange;description;Telekom;recurring
t-mobile;description;Telekom;recurring
plus.pl;description;Telekom;recurring
netia;description;Telekom;recurring
pge;description;Media dom;fixed
tauron;description;Media dom;fixed
enea;description;Media dom;fixed
pgnig;description;Media dom;fixed
zus;description;Podatki/ZUS;fixed
urzad skarbowy;description;Podatki/ZUS;fixed
przelewy24;description;Płatność online;variable
payu;description;Płatność online;variable
paypal;description;Płatność online;variable
blik p2p;description;Przelewy prywatne;variable
```

Uwaga semantyczna: `przelewy24`/`payu`/`blik p2p` to bramki, nie sklepy — kategoria
celowo neutralna z niskim priorytetem (ustaw `priority=900` dla bramek, `500` dla
merchantów; pierwsze trafienie wygrywa, więc konkretny merchant w opisie wygra z bramką).

**Zakres:** loader (`@Component`, `ApplicationRunner` albo `@PostConstruct` w serwisie;
parsuj przez `CsvSupport`), upsert idempotentny, testy: (1) drugi start nie duplikuje,
(2) na fixture z 18.1/18.2 ≥60% transakcji łapie regułę seed (fixture był projektowany
z typowymi merchantami — patrz 18.1 pkt 2).

**Acceptance:** po `recategorize` na zaimportowanym fixture ≥60% skategoryzowane
samymi seedami; restart backendu nie zmienia liczby reguł; reguły seed widoczne
i edytowalne w UI reguł.

**Seed prompt:** „EPIC-18 §18.5: dodaj merchant-seed.csv (zawartość w dokumencie),
loader z idempotentnym upsertem do category_rules (source='seed', dedup jak w EPIC-9),
priorytety 500/900 wg dokumentu, testy idempotencji i pokrycia na fixture mBank.
Branch `feat/epic-18-merchant-seed`."

---

## 18.6 · Confidence + audit trail kategorii · zależy: 18.2, 18.5

**Cel:** użytkownik widzi PRZY KAŻDEJ transakcji, skąd wzięła się kategoria
(która reguła / LLM z jaką pewnością / ręcznie) i umie znaleźć „najmniej pewne".
To jest odpowiedź na rynkowy sceptycyzm „AI = czarna skrzynka" (RELEASE-2026 §2).

**Zakres:**
1. Migracja Flyway `V<next>` (sprawdź najwyższy numer!):

   ```sql
   alter table finance.transactions
       add column category_source text,        -- 'rule:<id>' | 'llm' | 'manual' | null
       add column category_confidence numeric(3,2);  -- 1.00 rule/manual; z LLM jego score
   ```

2. Backend: w miejscach, które ustawiają `category_id` (ingest-hook, `recategorize`,
   ścieżka LLM, override usera — znajdź je: `grep -rn "category_id" backend/src/main/kotlin/`)
   ustawiaj też source/confidence. LLM: `OllamaLlmCategorySuggester` już operuje
   `minConfidence` (`LlmProperties`) — przepuść confidence do zapisu.
3. API: dołóż oba pola do DTO transakcji (`dto/FinanceDtos.kt` + mapper).
4. Front (`src/components/transactions/`): badge przy kategorii — ikona/kolor wg źródła,
   tooltip: `Reguła #12: description contains "zabka"` (treść reguły dociągnij z istniejącego
   API reguł) / `LLM (qwen3): 0.82` / `Ręcznie`. Sortowanie/filtr „najmniej pewne najpierw"
   (null confidence = na końcu… nie, na POCZĄTKU listy niepewnych — null znaczy
   nieskategoryzowana w ogóle).
5. Po imporcie (wynik `POST /api/ingest`) front pokazuje skrót: „N transakcji,
   X skategoryzowanych regułami, Y wymaga Twojej decyzji → [pokaż niepewne]".

**Pułapki:** override usera MUSI nadpisać source na `manual` i confidence 1.00
(precedencja z EPIC-9); `recategorize` nie dotyka `manual` (to już jest wymagane —
upewnij się testem, że source tego nie psuje).

**Acceptance:** po imporcie fixture każda skategoryzowana transakcja ma source;
tooltip pokazuje realną treść reguły; filtr niepewnych działa; test backendu:
recategorize nie zmienia transakcji `manual`.

---

## 18.7 · Wizard importu (onboarding) · zależy: 18.2, 18.6

**Cel:** od „mam plik z banku" do „widzę skategoryzowane transakcje" bez czytania docs.

**Zakres:**
1. Backend: `POST /api/ingest/preview` — to samo multipart co `/api/ingest`, ale
   **dry-run**: parsuje, zwraca pierwsze 5 `CanonicalTx` + licznik wszystkich + listę
   problemów (wiersze pominięte). ZERO zapisu. Implementacja: wydziel z `IngestService`
   czyste `parseOnly(bank, input)` i użyj go w obu endpointach (refactor, nie kopia).
2. Front: 4 kroki w `IngestSection.tsx` (albo nowy `ImportWizard.tsx` obok — zdecyduj
   po przeczytaniu istniejącego komponentu, preferuj rozszerzenie):
   krok 1 wybór banku (kafelki z logo/nazwą + „Twojego banku nie ma? → [issue]"),
   krok 2 plik (drag&drop; przy wyborze banku pokaż instrukcję „gdzie w iPKO/mBanku
   kliknąć eksport" — 2 zdania per bank, treść w stałej, łatwa do edycji),
   krok 3 podgląd (tabela 5 wierszy z preview + „wygląda dobrze?"),
   krok 4 import + podsumowanie z 18.6 pkt 5 (link do niepewnych).
3. Stany błędów: preview z 0 transakcji → komunikat „nie rozpoznaliśmy formatu" +
   przycisk raportu z 18.8.

**Acceptance:** test zimnego użytkownika (żona/kolega): od pliku do skategoryzowanej
listy bez pytań; błędny plik (np. PDF podany jako CSV) kończy się czytelnym
komunikatem, nie stacktrace.

---

## 18.8 · Raport parsera (anonimowa diagnostyka) · zależy: 18.7

**Decyzja (D5):** diagnostyka NIE zawiera danych — tylko struktura. To zastępuje
„przyślij mi swój wyciąg".

**Zakres:**
1. Backend: rozszerz wynik `parse`/`preview` o diagnostykę zbieraną w adapterach:

   ```kotlin
   data class ParseDiagnostics(
       val bank: String,
       val totalLines: Int,
       val parsedRows: Int,
       val skippedRows: Int,
       val headerFound: Boolean,
       val unknownHeaders: List<String>,   // nazwy kolumn, których nie zmapowano
       val errorKinds: Map<String, Int>,   // np. "unparseable-date" -> 3 (BEZ wartości!)
       val encodingUsed: String,           // "UTF-8" | "windows-1250"
   )
   ```

   **Twardy wymóg:** żadnych wartości komórek w diagnostyce. Nazwy kolumn — tak,
   zawartość — nigdy. Test jednostkowy: diagnostyka z fixture'a nie zawiera żadnej
   kwoty/nazwiska z fixture'a (asercja `not contains`).
2. Front: przy błędach importu przycisk „Skopiuj raport dla twórcy" → JSON do schowka +
   link do issue `bank_format_request` z instrukcją wklejenia.

**Acceptance:** test redakcji zielony; raport z celowo uszkodzonego pliku jest
użyteczny (mówi: nagłówek nieznaleziony / kodowanie / które kolumny obce).

---

## 18.9 · Tabela pokrycia banków · zależy: 18.2–18.4 (stan faktyczny)

**Zakres:** `docs/banks.md` — tabela: Bank · Format · Status (✅ wspierany / 🧪 beta /
🗳 planowany — głosuj w issue) · Fixture (link) · Uwagi (kodowanie, znane ograniczenia).
Wiersze startowe: Alior CSV ✅, VeloBank PDF ✅ (z notą z EPIC-8 o potrzebie realnego
fixture'a), mBank CSV, ING CSV, PKO CSV wg stanu po 18.2–18.4, Santander/Millennium/
Pekao 🗳 z linkami do issues. README: sekcja „Supported banks" = skrót tabeli + link.
W aplikacji: krok 1 wizarda linkuje do docs/banks.md.

**Acceptance:** tabela zgodna ze stanem kodu (źródło prawdy: enum `BankSource` + testy);
linki działają.

---

## Definition of Done fazy F1

- Realny wyciąg mBank importuje się w 100%, sumy zgodne z bankiem.
- ≥80% transakcji z realnego importu ma kategorię z reguł (seed+własne) PRZED LLM.
- Wizard przechodzi test zimnego użytkownika.
- `v1.2.0` + tag + changelog → **launch PL wg MARKETING-2026 §Launch Wykop**.

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Świeży realny eksport z mBanku (pełny miesiąc) importuje się bez błędów; suma kwot okresu zgadza się z saldem/sumą w banku co do grosza
- [ ] Ponowny import tego samego pliku: 0 nowych transakcji (dedup), żadnych duplikatów na liście
- [ ] Po imporcie ≥80% transakcji ma kategorię z reguł (badge „reguła"), zanim w ogóle włączysz LLM (LLM_ENABLED=false)
- [ ] Tooltip kategorii pokazuje konkretną regułę („description contains 'zabka'"); ręczna poprawka kategorii ma badge „ręcznie" i przeżywa recategorize + reload
- [ ] Filtr „najmniej pewne" pokazuje transakcje LLM/nieskategoryzowane na górze
- [ ] Wizard: osoba spoza projektu przechodzi od pliku do skategoryzowanej listy bez Twojej pomocy; podsunięcie złego pliku daje czytelny komunikat + działający „Skopiuj raport dla twórcy"
- [ ] Raport parsera wklejony do notatnika nie zawiera ŻADNEJ kwoty, nazwiska ani numeru konta z pliku
<!-- HUMAN-VERIFY:END -->
