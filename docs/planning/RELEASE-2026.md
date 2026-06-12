# RELEASE-2026 — plan wyjścia savings-planner na rynek (master doc)

Data: 2026-06-12 · Status: **decyzje zatwierdzone, gotowe do egzekucji** · Właściciel: Jakub

> **Jak używać tego dokumentu (dla agentów):** to jest źródło prawdy dla decyzji
> strategicznych release'u. NIE relitygujesz tych decyzji w chunkach — jeśli chunk
> wydaje się z nimi sprzeczny, zatrzymaj się i zapytaj Jakuba. Szczegóły
> implementacyjne żyją w dokumentach EPIC:
>
> - **F0** → `docs/planning/EPIC-17-release-readiness.md`
> - **F1** → `docs/planning/EPIC-18-polskie-banki.md`
> - **Marketing/posty** → `docs/planning/MARKETING-2026.md`
> - Kontekst produktu → `README.md`, architektura backlogu → `ROADMAP-2026.md`

---

## 1. Pozycjonowanie (jedno zdanie)

> **Self-hosted planer majątku i oszczędności dla polskich domowników: net worth,
> kredyt, IKZE, FIRE i Twoja osobista inflacja — dane zostają u Ciebie.**

- **Czym NIE jesteśmy:** "kolejnym expense trackerem" ani konkurencją dla kopertówek
  (4grosze/EasyBudget). Import i kategoryzacja transakcji to **feature**, nie tożsamość.
- **Dwa kliny wejścia (wedge):**
  1. **Próżnia po Kontomierzu** — jedyna polska apka z agregacją banków umiera
     (martwy support, exodus userów po redesignie; źródło: czerwona-skarbonka.pl/kontomierz-opinie,
     wykop.pl/tag/kontomierz). Techniczni użytkownicy szukają alternatywy, której zaufają.
  2. **Koszyk inflacyjny** — osobiste CPI z maili zakupowych (Frisco/Lisek), shrinkflacja,
     porównanie z GUS. **Nikt na rynku tego nie ma.** Działa w 100% w przeglądarce —
     idealny hak na Show HN i Wykop.

## 2. Skrót researchu rynkowego (2026-06-12)

Pełne dane: `~/Documents/Last30Days/aplikacja-do-sledzenia-finansow-budzet-domowy-polski-rynek-raw-v3.md`

| Ustalenie | Konsekwencja dla nas |
|---|---|
| Polska dyskusja żyje na Wykopie (#budzetdomowy, #kontomierz) i w grupach FB, NIE na Reddicie | Launch PL = Wykop; Reddit/HN = launch EN |
| Kontomierz: support martwy, userzy uciekają, rankingi wciąż go polecają | Wejście "alternatywa dla Kontomierza" + support jako feature |
| Polacy: awersja do abonamentów, preferencja lifetime (wątki o cenie YNAB) | Monetyzacja: lifetime, nigdy subskrypcja |
| Polskie apki = proste kopertówki; zero net worth/FIRE/IKZE/self-hosted | Nasza nisza (self-hosted × PL × majątek) jest pusta |
| Globalny self-hosted (Actual 27K★, Firefly 24K★): wieczny pain = import z banku; Firefly rozwiązuje to repo `import-configurations` per kraj/bank | Kopiujemy wzorzec: publiczna tabela pokrycia banków + fixtures + szablon issue "bank format request" |
| r/selfhosted: lokalne LLM w homelabie to mainstream | Nasza kategoryzacja Ollama-only to zaleta, komunikować wprost |

## 3. Decyzje strategiczne (D1–D12) — NIE relitygować w chunkach

| # | Decyzja | Uzasadnienie / odrzucone alternatywy |
|---|---|---|
| D1 | **Tożsamość: planer majątku**, transakcje to moduł | W "import+kategoryzacja" konkurujemy z Actual/Firefly i światem; w "planer majątku PL self-hosted" — z nikim |
| D2 | **Dwa tryby = dwa komunikaty**: local (przeglądarka, zero instalacji, demo) i API (homelab, pełnia) | Zlepienie ich w jeden przekaz myli; demo online możliwe TYLKO dzięki local mode (zero GDPR — dane nie opuszczają przeglądarki) |
| D3 | Release w fazach **F0→F3**, bramka między fazami = blok HUMAN-VERIFY na savings.lan | Istniejąca dyscyplina repo (pre-commit hook); nie wypuszczamy nic publicznie przed końcem F0 |
| D4 | **Banki: jakość > ilość.** Istnieją Alior CSV + Velo PDF; dodajemy mBank → ING → PKO. Publiczna tabela pokrycia. Fixtures TYLKO syntetyczne | 3 banki perfekcyjnie + ścieżka zgłoszeń bije 7 połowicznych; realne wyciągi NIGDY nie trafiają do repo/issues |
| D5 | **Beta bez danych użytkowników**: lokalny "raport parsera" (bank, liczby, typy błędów — zero kwot/opisów), wklejany ręcznie do issue | "Przyślij mi swój wyciąg" zabija pozycjonowanie privacy; raport+fixture zastępuje dostęp do danych |
| D6 | **Monetyzacja**: rdzeń MIT na zawsze; GitHub Sponsors + buycoffee.to od F0; lifetime "Supporter Pack" (99–149 zł: raport PDF, household, priorytet bank-requestów) po F2. **NIGDY hosted SaaS** | Jakub świadomie nie chce GDPR/security odpowiedzialności hostingu cudzych danych; zmiana licencji po fakcie = utrata zaufania (nie robimy "open-core bait&switch") |
| D7 | **Język: PL-first.** UI po polsku do końca F1 (launch Wykop). i18n (PL kanoniczny + EN) to chunk w F2 i **bramka** przed r/selfhosted i Show HN | Tłumaczenie wszystkiego teraz opóźnia launch PL o tygodnie; EN README już istnieje |
| D8 | **Mobile = PWA** (F3, EPIC 6 z ROADMAP). LLM ZOSTAJE na serwerze (Ollama, `LLM_*` env już istnieje). **Zero on-device ML** | W modelu self-hosted telefon to klient (LAN/Tailscale/CF Access); on-device model miałby sens tylko w produkcie dla nie-self-hosterów = inny produkt, nie teraz |
| D9 | **Open banking: nie budujemy AIS.** Ewentualnie GoCardless/Nordigen jako opcjonalny moduł off-by-default, dopiero po trakcji (F4+) | Własny AIS = licencja KNF; GoCardless to legalna droga (robi tak Firefly), ale wysyła dane do pośrednika — sprzeczne z głównym przekazem, więc tylko jako świadomy opt-in później |
| D10 | **Git: forgejo = canonical + deploy (push main = savings.lan). GitHub = publiczny mirror** przez Forgejo push-mirror (skonfigurować w F0). Pages demo i issue templates żyją na GitHubie | Społeczność/gwiazdki/Pages są na GitHubie; deploy i prywatność CI w homelabie |
| D11 | **Auth na publiczny release: token staje się hasłem** (wariant A w EPIC-17.1): nginx przestaje wstrzykiwać `X-Api-Token`, front pyta o token (ekran logowania, localStorage), backend porównuje constant-time + odmawia startu na domyślnym tokenie. **Bez JWT, bez multi-user** — single-tenant zostaje (1 gospodarstwo = 1 instancja) | Tak robi Actual Budget (jedno hasło); JWT/konta = powierzchnia błędów bez zysku przy single-tenant |
| D12 | **Wersje**: koniec F0 = `v1.1.0`, koniec F1 = `v1.2.0` i to jest publiczny launch. CHANGELOG po angielsku | Semver już obowiązuje (README); EN changelog czytelny dla globalnej społeczności self-hosted |

**Sprostowanie ważne dla marketingu:** w tej apce **nie ma żadnego BYOK / chmurowego LLM**.
Kategoryzacja = reguły deterministyczne → lokalny Ollama (`OllamaLlmCategorySuggester`,
domyślnie wyłączony `LLM_ENABLED=false`). Przekaz "transakcje nigdy nie opuszczają Twojej
infrastruktury" jest w 100% prawdziwy — komunikować to wprost, to przewaga nad
"AI-powered" konkurencją.

## 4. Mapa faz

| Faza | Zakres | Dokument | Czas (przy ~8 h/tydz) | Wynik / bramka |
|---|---|---|---|---|
| **F0** Release-readiness | auth-hasło, przycisk demo, demo online (Pages), docs społeczności, nudges ops, README+GIF, v1.1.0 | EPIC-17 | 2–3 tyg | Obcy stawia apkę z README w <10 min; demo klikalne online |
| **F1** Polskie banki | fixtures mBank/ING/PKO, 3 adaptery, słownik merchantów PL, confidence+audit trail, wizard importu, raport parsera, tabela pokrycia, v1.2.0 | EPIC-18 | 4–6 tyg | ≥80% kategoryzacji na realnym imporcie; **publiczny launch PL (Wykop)** |
| **F2** Pętla wartości | patrz §5 | (rozpisać EPIC-19 po F1) | 4 tyg | i18n EN → **launch EN (r/selfhosted, Show HN)** |
| **F3** Zasięg | PWA (ROADMAP EPIC 6), household mode, raport roczny PDF | (po F2) | — | Supporter Pack |

## 5. F2 — chunki w zarysie (rozpisać na pełny EPIC-19 po zakończeniu F1)

Świadomie NIE rozpisane do poziomu implementacji — szczegóły zależą od feedbacku z launchu PL.
Zakres i acceptance zamrożone, "jak" — nie.

- **19.1 Subskrypcje ↔ transakcje**: leak analysis (`backend/.../leakanalysis/`) wykrywa
  recurring charges, sekcja Abonamenty trzyma listę ręczną — spiąć: propozycja "wykryto
  abonament X 23,00 zł/mc — dodać do listy?" + rozjazd kwot (lista vs rzeczywistość).
  Acceptance: wykryty abonament da się 1 klikiem przyjąć do listy; kwota z transakcji
  aktualizuje pozycję.
- **19.2 Hero "ile mogę bezpiecznie odłożyć"**: wynik `nextBestAction` + wolne środki
  jako pierwsza karta Przeglądu (dziś trzeba wejść w Plan). Acceptance: świeży user
  widzi kwotę i jedno zdanie "dlaczego" bez nawigacji.
- **19.3 Eksport CSV per widok** (transakcje, snapshoty, koszyk): łatwe wyjście z apki =
  zaufanie. Acceptance: każdy główny widok ma "Eksportuj CSV", plik otwiera się w Excelu
  z polskimi znakami (UTF-8 BOM!).
- **19.4 i18n**: react-i18next, PL = kanoniczny, EN = pierwszy przekład; namespace per
  workspace; language switcher w Ustawieniach. **Bramka launchu EN.** Acceptance:
  `npm run lint` łapie hardcoded stringi w komponentach (eslint rule), całe UI przełącza
  się na EN bez "mieszanki".
- **19.5 Onboarding "pustej apki"**: tour 3 kroki (dodaj konto → snapshot → cel) dla
  usera, który nie chce demo. Acceptance: od pustego stanu do pierwszego wykresu <5 min.

## 6. Anti-roadmapa — czego ŚWIADOMIE nie robimy (i czemu)

Dla modeli wykonujących: jeśli "ulepszasz" chunk o coś z tej listy — STOP, to nie jest pomoc.

1. **Własna integracja bankowa / scraping banków** — AIS wymaga zezwolenia KNF (PSD2);
   scraping łamie regulaminy banków. Droga: pliki + (kiedyś) GoCardless opt-in.
2. **Multi-user / konta / role** — single-tenant (ROADMAP decyzja #4). Household mode (F3)
   = wspólna instancja, nie system kont.
3. **Natywne aplikacje mobilne** — PWA wystarcza; sklepy = koszt bez zysku dla self-hosted.
4. **Hosted SaaS / "wersja chmurowa"** — D6.
5. **Pełny multi-currency accounting** — FX z NBP (EPIC-16) wystarcza do net worth;
   księgowość wielowalutowa to studnia bez dna.
6. **Przepisywanie stacku** (backend na Go/Rust, front na inny framework) — stack jest
   świeży i dydaktyczny (nauka Kotlina to jawny cel repo).
7. **Chmurowy LLM / BYOK** — psuje główną obietnicę. Ollama-only.
8. **Reklamy / telemetria** — oczywiste.

## 7. Metryki i rytuał tygodniowy

**Metryki sukcesu roku 1** (cel: społeczność, nie przychód): 200+ ★ GitHub, 20 realnych
instalacji (sygnał: issues/dyskusje od obcych), 5 kontrybutorów formatów bankowych,
pierwsza wzmianka o apce nie-napisana przez Jakuba.

**Rytuał (60–90 min/tydz, stały slot):**
1. (15 min) Wykop: przejrzyj #budzetdomowy #kontomierz #selfhosted — zanotuj bóle/cytaty
   do `docs/planning/MARKETING-2026.md` §Obserwatorium.
2. (15 min) Odpowiedz na WSZYSTKIE issues/komentarze <48 h (support = feature, D4/wedge 1).
3. (30 min) 1 post build-in-public (changelog, mini-feature, wykres) wg kalendarza w MARKETING-2026.
4. (15 min) Zapisz metryki (stars/pulls/issues) w tabelce na dole MARKETING-2026.

## 8. Alokacja czasu (przy ~8 h/tydz)

- 4 h produkt (chunki bieżącej fazy, jedna rzecz naraz, sekwencyjnie),
- 2 h release-infra/docs (też chunki, ale "okołoproduktowe"),
- 2 h rynek (rytuał §7) — **dopiero od końca F0**; wcześniej te 2 h idą w produkt.

Zasady: nie ogłaszamy niczego przed końcem F0 (pierwsze wrażenie jest jedno);
nie dokładamy ficzerów spoza otwartej fazy; każdy chunk = osobny branch + PR + HUMAN-VERIFY.

## 9. Formalności (PL) — gdy pojawi się pierwszy przychód

- Dobrowolne wpłaty (Sponsors/buycoffee) i sprzedaż licencji na małą skalę → na start
  **działalność nierejestrowana** (limit przychodu = 75% minimalnego wynagrodzenia
  miesięcznie; ewidencja sprzedaży obowiązkowa).
- Po przekroczeniu limitu / przy regularnej sprzedaży → JDG, zwykle ryczałt.
- **To nie jest porada podatkowa** — przy pierwszych 100+ zł/mc skonsultować z księgowym
  (jednorazowa konsultacja ~200–300 zł).

## 10. Proces delegowania chunka (przypomnienie)

1. Branch `feat/epic-NN-<slug-chunka>` od aktualnego `main`.
2. Agent czyta: ten dokument → dokument EPIC-a → pliki z sekcji "Stan wejściowy" chunka.
3. Kod backendu = komentarze dydaktyczne Kotlin (ROADMAP-2026 §"Zasady nauki Kotlina",
   styl "INTERVIEW Q" jak w `SecurityConfig.kt`).
4. PR z sekcją "Czego się tu uczysz" (backend) + zielone: `npm run lint && npm test`,
   `./gradlew test` (Testcontainers na CI).
5. Merge do `main` na forgejo = deploy na savings.lan → checklist HUMAN-VERIFY przychodzi
   na Telegram → Jakub odhacza → checkpoint (brain-memory + Todoist).
