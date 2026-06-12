# MARKETING-2026 — kanały, kalendarz, gotowe treści

Data: 2026-06-12 · Powiązane: `RELEASE-2026.md` (decyzje D1–D12), research:
`~/Documents/Last30Days/aplikacja-do-sledzenia-finansow-budzet-domowy-polski-rynek-raw-v3.md`

> **Dla agentów:** treści poniżej są GOTOWE do publikacji po podstawieniu
> placeholderów `{...}`. Nie zmieniaj tonu (rzeczowy, zero marketing-speak,
> pierwszoosobowy). Publikuje CZŁOWIEK (Jakub) ze swoich kont — agent może
> przygotować finalny tekst, nigdy nie publikuje sam. Każdy post przed publikacją:
> sprawdź zgodność z D1–D12 (zwłaszcza: nie obiecujemy open bankingu, nie ma
> chmurowego LLM, nie ma SaaS).

## 0. Zasady (nie łamać)

1. **Disclosure zawsze**: „jestem autorem" w pierwszym zdaniu lub tagu. Ukryta
   autopromocja na Wykopie/Reddicie = spalony kanał na zawsze.
2. **Jeden kanał naraz**, min. 3–4 dni odstępu — feedback z pierwszego poprawia drugi.
3. **Odpowiadaj na WSZYSTKO <24 h** przez pierwsze 72 h po publikacji (support = feature).
4. **Nie broń się, dziękuj**: krytyka formatu/feature'a → „masz rację, wrzucisz issue?
   albo ja założę i podlinkuję". Hejt bez treści → ignoruj.
5. **Krytyka konkurencji tylko faktograficzna**: o Kontomierzu mówimy „support nie
   odpowiada, użytkownicy to zgłaszają" (z linkiem), nigdy „to złom".
6. Posty EN dopiero po i18n (F2, D7). Posty PL — po F1.

## 1. Kalendarz względem faz

| Kiedy | Kanał | Treść | Bramka |
|---|---|---|---|
| F0 done | Wykop mikroblog | §2 feedback-fishing | HUMAN-VERIFY EPIC-17 ✅ |
| F0–F1 | Wykop | 1×/tydz build-in-public (§8) | — |
| F1 done = v1.2.0 | Wykop | §3 launch PL | HUMAN-VERIFY EPIC-18 ✅ |
| +3–4 dni | r/Polska lub r/inwestowanie | §4 | jw. |
| +1 tydz | grupy FB (2–3) | §5 | jw. |
| F2: i18n done | r/selfhosted | §6 launch EN | UI w pełni EN |
| +1–2 tyg | Show HN | §7 | demo Pages EN |
| po Show HN | awesome-selfhosted PR, alternativeto, selfh.st | §9 | — |
| z case study | blogerzy finansowi PL (JOP, Iwuć, Subiektywnie) | mail: §10 | ≥20 userów, historia |

## 2. Wykop — feedback-fishing (PL, po F0)

Tagi: `#budzetdomowy #finanse #oszczedzanie #selfhosted #programowanie #kontomierz`

> Mirki od #budzetdomowy — robię po godzinach open-source'ową apkę do planowania
> oszczędności i majątku (jestem autorem). Self-hosted: stawiasz u siebie (docker)
> albo odpalasz w przeglądarce — dane nie wychodzą poza Twój komputer/serwer. Bez
> konta, bez abonamentu, bez wysyłania historii konta do czyjejś chmury.
>
> Co już robi: net worth z historią kont, plan spłaty kredytu z nadpłatami, IKZE,
> projekcja FIRE, import wyciągów (na razie Alior/VeloBank, mBank w drodze)
> z kategoryzacją regułami + opcjonalnie lokalnym LLM (Ollama — nic nie leci do
> OpenAI). Bonus, którego nie ma nigdzie: **koszyk inflacyjny** — wrzucasz maile
> z Frisco/Liska i widzisz SWOJĄ inflację vs GUS, łącznie ze shrinkflacją.
>
> Klikalne demo (dane zostają w przeglądarce): {LINK_DEMO}
> Kod: {LINK_GITHUB}
>
> Pytanie, nie promka: **co Was najbardziej wkurza w Kontomierzu / YNAB / arkuszu?**
> Czego brakuje, żebyście w ogóle rozważyli self-hosted? Z jakiego banku potrzebujecie
> importu najpierw? Każdą odpowiedź czytam i zamieniam w issue.

Follow-up w komentarzu (po 2–3 odpowiedziach): podziękowanie + link do
`docs/banks.md` („głosowanie na banki tutaj").

## 3. Wykop — launch PL (po F1, v1.2.0)

Tagi jw. + `#pokazprojekt`

> Pół roku temu mój arkusz „Finanse" przestał wystarczać, a Kontomierzowi przestałem
> ufać (support milczy od miesięcy — sprawdźcie #kontomierz). Zbudowałem własną
> apkę i dziś wypuszczam ją publicznie (jestem autorem, open source, MIT).
>
> **Savings Planner** — self-hosted planer majątku dla polskich domowników:
> • net worth ze snapshotów kont (u mnie: historia od 2022) + wykresy
> • import wyciągów: mBank, Alior, VeloBank{, ING, PKO — wg stanu} — kategoryzacja
>   regułami, ≥80% trafień od pierwszego importu, każda kategoria pokazuje DLACZEGO
> • plan kredytu z nadpłatami i refinansowaniem, IKZE, projekcja FIRE
> • koszyk inflacyjny z maili Frisco/Lisek — Twoja osobista inflacja vs GUS + shrinkflacja
> • zero chmury: dane w Twojej przeglądarce albo na Twoim serwerze; LLM tylko lokalny
>   (Ollama), domyślnie wyłączony; bez konta, telemetrii i abonamentu
>
> Demo w 2 kliki (nic się nigdzie nie wysyła): {LINK_DEMO}
> Docker: `docker compose up` — instrukcja: {LINK_GITHUB}
> Nie ma Twojego banku? Zgłoś format (bez danych, sam nagłówek): {LINK_BANKS_MD}
>
> Stack dla ciekawych: React 19 + TS, Kotlin + Spring Boot, Postgres, self-host przez
> docker compose za nginx. Pytajcie o wszystko, odpowiadam na każdy komentarz.

## 4. r/Polska / r/inwestowanie (PL, +3–4 dni po §3)

Tytuł: **Zbudowałem open-source'owy, self-hosted planer finansów domowych (net worth,
kredyt, IKZE, FIRE, import z polskich banków) — bo nie chciałem oddawać historii konta
kolejnej apce**

> Cześć, autor tutaj. TL;DR: {LINK_DEMO} (demo w przeglądarce, dane nie wychodzą),
> kod: {LINK_GITHUB}, MIT.
>
> Dlaczego powstało: apki bankowe widzą tylko jeden bank, Kontomierz [umiera]({LINK_WYKOP_KONTOMIERZ}),
> YNAB kosztuje ~400 zł/rok i nie zna IKZE ani polskich banków, a arkusz nie powie,
> kiedy spłacisz kredyt przy nadpłacie 500 zł/mc. […2–3 zdania o tym, co robi —
> skrót z §3…]
>
> Czego szukam: feedbacku od ludzi, którzy realnie prowadzą budżet. Co by Was
> powstrzymało przed użyciem? Jaki bank mam wesprzeć następny?

Zasady subów: przeczytaj regulamin self-promo PRZED publikacją; jeśli wymagany
flair/zgoda modów — napisz do modów najpierw (szablon: „jestem autorem open-source
narzędzia bez monetyzacji, czy mogę…").

## 5. Grupy FB (PL): „Budżet domowy…", „FIRE Polska", „Homelab Polska"

Wersja krótka (FB ucina): hak = koszyk inflacyjny dla grup budżetowych,
self-host/docker dla homelabowych.

> Zrobiłem darmową, open-source apkę, która liczy **Twoją osobistą inflację** z maili
> z zakupów (Frisco/Lisek) i porównuje z GUS — plus pełny planer: konta, kredyt, IKZE,
> FIRE. Działa w przeglądarce, dane zostają u Ciebie (jestem autorem, bez reklam
> i abonamentu). Demo: {LINK_DEMO}. Szukam osób, które przetestują import ze swojego
> banku — obsługuję {LISTA}, kolejne wg zgłoszeń. Mods: jeśli post łamie zasady, usuńcie/dajcie znać.

## 6. r/selfhosted — launch EN (po i18n, F2)

Title: **I built a self-hosted household savings & net-worth planner with Polish bank
imports, a deterministic "what to do with this month's money" engine, and a personal
inflation tracker (React + Kotlin, MIT)**

> Author here. After my bank's PFM and a dying local aggregator (Kontomierz) lost my
> trust, I built my own. Sharing because the architecture might interest this sub:
>
> - **Two modes**: pure client-side (all data in localStorage, the online demo runs
>   like this — nothing leaves your browser) or docker compose with a Kotlin/Spring
>   backend + Postgres for bank-statement imports and pay-period budgeting.
> - **Categorization is rules-first**: deterministic engine, optional **local LLM
>   fallback via Ollama** (off by default). Every LLM verdict is materialized into
>   a rule, so the model runs less and less over time. Every category shows *why*
>   (which rule / confidence). No cloud AI, period.
> - **Planning engine is deterministic, not AI**: one ranked "next best action"
>   (cover deficit → rebuild buffers → tax-advantaged retirement → top goal).
> - **Personal CPI**: parses grocery order-confirmation emails (.eml) in the browser,
>   builds a Laspeyres index from YOUR basket, detects shrinkflation, overlays the
>   official index.
> - Mortgage overpayment planner, FIRE projection with bands, multi-year account
>   snapshots, NBP FX rates.
>
> Demo (client-side only): {LINK_DEMO} · GitHub: {LINK_GITHUB} · Bank coverage +
> how to request your bank's format (synthetic fixtures only, never real statements):
> {LINK_BANKS_MD}
>
> Honest limitations: Polish banks first (that's my itch), single-tenant by design,
> no open-banking sync (file imports only — see PRIVACY.md for why).
> Happy to answer anything about the stack or the rules-vs-LLM tradeoff.

## 7. Show HN (po §6)

Tytuł — warianty (wybierz JEDEN, max ~80 znaków):
1. `Show HN: Track your personal grocery inflation from order-confirmation emails`
2. `Show HN: Self-hosted savings planner that computes your personal CPI locally`
3. `Show HN: A local-first household finance planner with rules-first categorization`

Rekomendacja: wariant 1 — koszyk to news, „budget app" to nie-news. URL: demo Pages
(nie repo — HN klika i chce coś zobaczyć; link do repo w pierwszym komentarzu).

Pierwszy komentarz (od autora, wkleić od razu po publikacji):

> Author here. The inflation tracker started as a side feature of my self-hosted
> savings planner and became the thing friends asked about most, so it leads the demo.
>
> How it works: you drop .eml order confirmations (two Polish grocery services
> supported so far) into the browser; a client-side parser extracts line items;
> products are matched across months by normalized name; a fixed-basket Laspeyres
> index is computed from YOUR purchases; shrinkflation detection flags same product +
> smaller size + similar price. You can overlay the official CPI for comparison.
> Everything runs in the browser — the demo has no backend at all.
>
> The rest of the app: deterministic "what should I do with this month's money"
> engine, multi-year net worth, mortgage overpayment planning, bank CSV imports with
> rules-first categorization and an optional local-LLM (Ollama) fallback that
> materializes its verdicts into rules. Stack: React 19 + TS front, Kotlin/Spring
> backend (optional), Postgres, MIT. GitHub: {LINK_GITHUB}
>
> Things I'd love feedback on: the name-based product identity (vs barcodes), and
> whether the fixed-basket index is the right default vs spend-weighted.

Zasady HN: odpowiadaj na każdy komentarz merytorycznie, przyznawaj ograniczenia wprost,
zero emoji, zero wykrzykników. Jeśli post nie wystartuje (zdarza się) — wolno
opublikować ponownie po ~2 tygodniach w inne okno czasowe (wt–czw, 14:00–17:00 CET).

## 8. Build-in-public (Wykop, 1×/tydz, F0→…)

Format: 1 screenshot/wykres + 3–5 zdań + link. Tematy z backlogu: „mBank parser —
czego nauczył mnie format CSV z 2001 roku", „ile naprawdę kosztuje Żabka — moje dane
z koszyka", „jak działa wykrywanie shrinkflacji", „dlaczego planner jest deterministyczny,
a nie AI", „v1.2.0 changelog po ludzku". Zawsze tag #budzetdomowy + disclosure.

## 9. Katalogi (po launchu EN)

- **awesome-selfhosted** (PR do sekcji Money/Budgeting):
  `- [Savings Planner]({LINK_GITHUB}) - Household savings and net-worth planner with bank statement import, rules-first categorization (optional local LLM), mortgage/FIRE planning and a personal grocery-inflation tracker. ([Demo]({LINK_DEMO})) ` + `` `docker` `` / język wg konwencji listy (sprawdź CONTRIBUTING listy przed PR — wymagają konkretnego formatu i kolejności alfabetycznej).
- **alternativeto.net**: dodaj wpis; "alternative to": Kontomierz, YNAB, Actual Budget,
  Firefly III; opis 2 zdania z §6; screenshots z README.
- **selfh.st**: submit przez ich formularz/repo (sprawdź aktualny proces na stronie).

## 10. Mail do blogerów PL (dopiero z case study, ≥20 userów)

Temat: Open-source'owa polska apka do finansów — materiał na wpis/wzmiankę?

> Dzień dobry, czytam {blog} od lat. Zbudowałem open-source'owy (MIT, bez monetyzacji)
> self-hosted planer finansów domowych z importem z polskich banków i „osobistą
> inflacją" liczoną z maili zakupowych. Po {N} tygodniach od premiery: {X} instalacji,
> {Y} gwiazdek, najczęstszy feedback: {…}. Jeśli temat „dane finansowe bez chmury"
> pasuje do {blog}, chętnie pokażę demo / odpowiem na pytania / napiszę gościnnie
> o {konkret, np. ile realnie zdrożał mój koszyk}. Demo: {LINK}. Pozdrawiam, Jakub.

## 11. Playbook odpowiedzi (FAQ — używaj zamiast improwizacji)

- **„RODO? Gdzie są moje dane?"** → Nigdzie poza Tobą. Tryb przeglądarkowy:
  localStorage, możesz wyeksportować/usunąć jednym kliknięciem. Self-host: Twój
  Postgres na Twoim sprzęcie. Nie mam serwera, kont użytkowników ani telemetrii —
  fizycznie nie mam jak zobaczyć Twoich danych. Szczegóły: docs/PRIVACY.md.
- **„Czemu nie łączy się z bankiem automatycznie?"** → Automatyczne łączenie = albo
  licencjonowany pośrednik AIS (Twoje dane przepływają przez third-party), albo
  scraping (łamie regulamin banku). Na start świadomie: import plików — 100% lokalnie.
  Open banking przez GoCardless rozważam później jako JAWNY opt-in (D9).
- **„Czym się różni od Actual Budget / Firefly III?"** → To świetne narzędzia do
  budżetowania kopertowego/księgowania. Savings Planner to planer MAJĄTKU: snapshoty
  kont, kredyt z nadpłatami, IKZE, FIRE, osobista inflacja — plus polskie banki
  out-of-box i UI po polsku. Jeśli chcesz envelope budgeting — bierz Actual, serio.
- **„Czym się różni od Kontomierza?"** → Kontomierz agreguje banki w swojej chmurze.
  Tu nie ma chmury i nie ma „ich" — kod jest otwarty, instancja jest Twoja, a jak
  znajdziesz buga, odpowiadam w issues, zwykle tego samego dnia.
- **„AI? Nie ufam wysyłaniu wyciągów do OpenAI."** → Ja też nie. Kategoryzacja to
  reguły (deterministyczne, widzisz którą regułą trafiło). Opcjonalny LLM to lokalny
  Ollama na TWOIM sprzęcie, domyślnie WYŁĄCZONY, a jego werdykty zamieniają się
  w reguły, więc z czasem odpala się coraz rzadziej.
- **„Jak na tym zarabiasz?"** → Na razie nijak (MIT, hobby). Plan: dobrowolne wsparcie
  + kiedyś jednorazowy „Supporter Pack" (PDF raporty, tryb household). Nigdy abonament
  za podstawy, nigdy wersja chmurowa, nigdy sprzedaż danych.
- **„Mój bank nie jest wspierany."** → Zgłoś format: {LINK_BANKS_MD} — wystarczy
  nagłówek CSV i jeden ZANONIMIZOWANY wiersz (instrukcja w szablonie). Nie przysyłaj
  prawdziwego wyciągu, nie przyjmę go.
- **„Czemu Kotlin/Spring do apki domowej?"** → Świadomie: projekt jest też moją nauką
  Kotlina (kod ma komentarze dydaktyczne). Działa w 512 MB RAM na małym CT w homelabie.
- **„Wystawiacie to do internetu?"** → Rekomendacja: nie wystawiaj; Tailscale/VPN/
  Cloudflare Access. Jak musisz: HTTPS + silny token (apka wymusza niedomyślny).

## 12. Obserwatorium bólu (uzupełniaj w rytuale tygodniowym)

Format wpisu: `data · źródło(link) · cytat/ból · → wniosek (issue/feature/treść posta)`

- 2026-06-12 · czerwona-skarbonka.pl/kontomierz-opinie · „sprawdza się jedynie jako
  lista transakcji", support milczy · → wedge #1 potwierdzone; w §3 linkować tag
  #kontomierz, nie recenzję (świeższe).
- 2026-06-12 · wykop #ynab · narzekania na cenę/abonament YNAB · → komunikat
  „bez abonamentu" w pierwszym akapicie każdego postu.
- 2026-06-12 · r/actualbudgeting (Plaid importer, UK bank imports) · import bankowy
  to wieczny temat self-hosted · → tabela banków jako PIERWSZY link w postach EN.
- (dopisuj…)

## 13. Metryki (wpisuj co tydzień, rytuał z RELEASE-2026 §7)

| Data | ★ GitHub | Forks | Issues otwarte/obce | Docker pulls | Demo wejścia* | Wzmianki | Notatka |
|---|---|---|---|---|---|---|---|
| 2026-06-12 | — | — | — | — | — | — | baseline przed F0 |

\* bez analytics (D: zero telemetrii) — proxy: GitHub traffic → Insights → Traffic
(unique visitors na Pages liczą się w repo traffic).
