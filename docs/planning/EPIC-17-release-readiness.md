# EPIC 17 — Release-readiness (F0) — plan wykonawczy

> Dla modelu wykonującego. Samowystarczalny — ale przeczytaj NAJPIERW
> `docs/planning/RELEASE-2026.md` (decyzje D1–D12; ich nie relitygujesz).
> Cel fazy: **obcy człowiek stawia apkę z README w <10 minut, demo klikalne online,
> instancja nadaje się do pokazania światu.** Wersja na koniec: `v1.1.0`.

## Stan wejściowy (zweryfikowane ścieżki — buduj na tym, nie od zera)

- **Auth**: `backend/src/main/kotlin/pl/jakubmikolajczyk/savings/config/SecurityConfig.kt`
  — filtr `ApiTokenFilter` porównuje nagłówek `X-Api-Token` zwykłym `==` z
  `SecurityProperties.apiToken` (`config/ApiProperties.kt`, prefix `app.security`).
  `nginx.conf.template` **wstrzykuje token każdemu** (linia `proxy_set_header X-Api-Token ${API_TOKEN};`)
  — czyli kto dosięgnie nginxa, ten ma API. OK w LAN, dyskwalifikujące publicznie.
- **Frontend token**: `src/api/client.ts:142` — `headers.set('X-Api-Token', API_TOKEN)`,
  stała z `import.meta.env.VITE_API_TOKEN`.
- **Ustawienia / import-eksport JSON**: `src/components/ui/AdvancedSettings.tsx`.
- **Store**: `src/store/index.ts` (Zustand 5, persist do localStorage; tryb `VITE_BACKEND=local|api`).
- **Demo dane**: `docs/demo-data.json`, generator `scripts/make-demo-data.mjs`.
- **Nudges**: kod kompletny (EPIC-16): `backend/.../nudges/`, `POST /api/nudges/test`,
  przycisk w Ustawieniach. Brakuje TYLKO env na CT111.
- **CI/CD**: `.forgejo/workflows/ci.yml` + `deploy.yml` (push `main` na forgejo → deploy
  savings.lan). GitHub jest mirrorem (D10).
- **Vite**: `vite.config.ts` — brak `base`, brak PWA. Testy FE: vitest, ~195 zielonych.
- **Wersja**: `package.json` = 1.0.0, `CHANGELOG.md` istnieje, tagi `vX.Y.Z` na oba remoty.

Kolejność: 17.1 → 17.2 → 17.3 (zależne), 17.4/17.5/17.6 równolegle, 17.7 na końcu.

---

## 17.1 · Auth: token staje się hasłem · zależy: —

**Decyzja (D11, wariant A)** — minimalna zmiana zaufania, zero nowych pojęć:
nginx PRZESTAJE wstrzykiwać token; front pyta o niego jak o hasło i zapamiętuje
w localStorage; backend traktuje token poważnie (constant-time, brak startu na domyślnym).
**Odrzucone:** JWT/sesje (powierzchnia błędów bez zysku przy single-tenant — argumentacja
w komentarzach `SecurityConfig.kt`), Spring user accounts (D11: bez multi-user),
basic auth w nginx (drugi credential do zarządzania, gorszy UX na telefonie).

**Zakres:**

1. **nginx** (`nginx.conf.template`): usuń linię `proxy_set_header X-Api-Token ${API_TOKEN};`
   i dodaj rate-limit na nieudane strzały do API:

   ```nginx
   # POZA blokiem server {} (plik jest include'owany w kontekście http):
   limit_req_zone $binary_remote_addr zone=api_limit:1m rate=10r/s;

   # w location /api/:
   limit_req zone=api_limit burst=20 nodelay;
   ```

   Uwaga: `limit_req_zone` MUSI być w kontekście `http` — w tym repo szablon jest
   include'owany do `conf.d/*.conf` wewnątrz `http {}`, więc dyrektywa na początku
   pliku (przed `server {`) jest poprawna. Jeśli nginx nie wstaje, to jest pierwsze
   miejsce do sprawdzenia (`nginx -t` w kontenerze).

2. **Backend** (`SecurityConfig.kt`):

   ```kotlin
   // zamiast: if (token == properties.apiToken)
   val expected = properties.apiToken.toByteArray(StandardCharsets.UTF_8)
   val provided = token?.toByteArray(StandardCharsets.UTF_8)
   if (provided != null && MessageDigest.isEqual(expected, provided)) { ... }
   ```

   *Dlaczego `MessageDigest.isEqual`:* zwykłe `==` na String porównuje znak po znaku
   i wychodzi przy pierwszej różnicy — czas odpowiedzi zdradza ile znaków tokenu jest
   poprawnych (timing attack). `MessageDigest.isEqual` porównuje w stałym czasie.
   (Dodaj komentarz dydaktyczny INTERVIEW Q w tym stylu.)

   Plus guard startowy — nowy bean w `SecurityConfig` (albo osobna klasa
   `config/StartupGuards.kt`):

   ```kotlin
   @Bean
   fun apiTokenGuard(env: Environment): InitializingBean = InitializingBean {
       val isProd = env.activeProfiles.contains("prod")
       val weak = securityProperties.apiToken.isBlank() ||
           securityProperties.apiToken == "change-me" ||
           securityProperties.apiToken.length < 16
       check(!(isProd && weak)) {
           "API_TOKEN is empty/default/short. Set a strong token in .env before exposing the app."
       }
   }
   ```

   Sprawdź nazwę aktywnego profilu prod w `backend/src/main/resources/application*.yml`
   zanim założysz `"prod"` — użyj faktycznej.

3. **Frontend**:
   - `src/api/client.ts`: zamiast stałej —

     ```ts
     const TOKEN_STORAGE_KEY = 'savings-planner.apiToken'
     export function getApiToken(): string {
       return localStorage.getItem(TOKEN_STORAGE_KEY) ?? import.meta.env.VITE_API_TOKEN ?? ''
     }
     export function setApiToken(token: string) { localStorage.setItem(TOKEN_STORAGE_KEY, token) }
     ```

     (fallback na `VITE_API_TOKEN` zostaje dla dev — `npm run dev` + lokalny backend
     działa bez logowania jak dotąd).
   - Nowy komponent `src/components/ui/TokenGate.tsx`: renderowany w `App` TYLKO gdy
     tryb API i pierwszy request zwrócił 401 (client powinien wystawić callback/flagę
     `onUnauthorized` — najprościej: store'owy stan `authRequired: boolean` ustawiany
     w kliencie przy 401, czyszczony po udanym zapisaniu tokenu i ponownej hydracji).
     Formularz: jedno pole typu password ("Token dostępu — ustawiony w pliku .env serwera
     jako API_TOKEN"), przycisk, komunikat błędu przy kolejnym 401.
   - Po zapisaniu tokenu: ponów hydrację stanu z backendu (ta sama ścieżka co przy starcie).

4. **Docs**: `.env.example` — komentarz przy `API_TOKEN` ("to jest hasło aplikacji;
   wygeneruj: `openssl rand -hex 32`"); README sekcja **"Exposing to the internet"**:
   HTTPS obowiązkowo, rekomendacja Tailscale / Cloudflare Access / VPN, apka NIE jest
   hardenowana na hostile internet.

**Pułapki:**
- W testach FE może istnieć asercja na nagłówek z `VITE_API_TOKEN` — zaktualizuj,
  nie usuwaj testu.
- Po deployu Jakub raz wpisze token na savings.lan (i w każdej nowej przeglądarce) —
  to zamierzone (D11), odnotuj w opisie PR.
- NIE loguj tokenu (ani w backendzie, ani w konsoli przeglądarki).

**Acceptance:** bez tokenu `/api/**` = 401 (nginx już nie ratuje); zły token = 401 +
TokenGate pokazuje błąd; dobry token = apka działa jak dotąd; `MockMvc` test filtra
(200/401); guard startowy ubija prod z `change-me` (test z `ApplicationContextRunner`);
lint+testy FE/BE zielone.

**Seed prompt:** „Przeczytaj `docs/planning/RELEASE-2026.md` (D11) i
`docs/planning/EPIC-17-release-readiness.md` §17.1. Wykonaj dokładnie zakres 1–4:
nginx przestaje wstrzykiwać X-Api-Token (+ limit_req), backend constant-time compare
+ startup guard, frontend TokenGate z localStorage, docs. Komentarze dydaktyczne
w stylu INTERVIEW Q jak w SecurityConfig.kt. Branch `feat/epic-17-auth-token-gate`."

---

## 17.2 · Przycisk „Załaduj dane demo" · zależy: —

**Decyzja:** kanoniczny plik demo przenosimy do `public/demo-data.json` (Vite serwuje
`public/` 1:1 i w dev, i w dist — fetch działa wszędzie, plik nie puchnie w bundlu JS).
`scripts/make-demo-data.mjs` pisze odtąd do `public/`, README aktualizuje ścieżkę.
**Odrzucone:** statyczny `import demo from ...json` (ładuje ~setki KB do głównego bundla
każdemu, także na produkcyjnych danych).

**Zakres:**
1. `git mv docs/demo-data.json public/demo-data.json` + popraw output w
   `scripts/make-demo-data.mjs` + odnośniki w README.
2. `src/components/ui/AdvancedSettings.tsx`: przycisk „Załaduj dane demo" →
   `fetch(import.meta.env.BASE_URL + 'demo-data.json')` → ta sama funkcja importu,
   której używa istniejący import JSON (reuse, ZERO nowej logiki walidacji).
   `BASE_URL` jest kluczowe — na GitHub Pages (17.3) app żyje pod `/savings-planner/`.
3. Widoczność: przycisk TYLKO w trybie local (`VITE_BACKEND !== 'api'`) — załadowanie
   demo do trybu API wysłałoby je do realnego Postgresa. Znajdź jak store/komponenty
   sprawdzają tryb (`grep -r "VITE_BACKEND" src/`) i użyj tego samego mechanizmu.
4. Pusty stan: na Przeglądzie, gdy brak jakichkolwiek danych (0 kont, 0 celów),
   karta powitalna: „Zacznij od danych demo" / „Zaimportuj swoje (Ustawienia → Import)".
   Komponent znajdziesz greppując nazwę workspace'u Przegląd w `src/components/`.

**Acceptance:** czysty profil przeglądarki → 2 kliki → pełny dashboard (wykresy,
koszyk, cele); w trybie API przycisku nie ma; test vitest na logikę „pusty stan →
pokazujemy CTA" (czysta funkcja/selektor, bez renderowania całej strony).

**Seed prompt:** „EPIC-17 §17.2: przenieś demo-data.json do public/, dodaj przycisk
Załaduj dane demo w AdvancedSettings (fetch BASE_URL, reuse istniejącego importu JSON,
tylko tryb local) + kartę pustego stanu na Przeglądzie. Branch `feat/epic-17-demo-button`."

---

## 17.3 · Demo online na GitHub Pages · zależy: 17.2

**Decyzja:** demo = build local-mode z mirrora GitHub przez GitHub Actions → Pages.
Forgejo nie ma Pages; deploy produkcyjny zostaje na forgejo (D10). Mirror aktualizuje
się sam: **Forgejo push mirror** (krok manualny Jakuba, instrukcja niżej).
**Odrzucone:** osobny hosting (Netlify/CF Pages) — kolejne konto/serwis bez potrzeby.

**Zakres:**
1. `vite.config.ts`: `base: process.env.VITE_BASE || '/'` (build-time, nie dotyka dev).
2. Banner demo: komponent `src/components/ui/DemoBanner.tsx` renderowany gdy
   `import.meta.env.VITE_DEMO_BANNER === 'true'`: „🔒 Tryb demo — wszystkie dane żyją
   wyłącznie w Twojej przeglądarce. [GitHub]". Nie da się go zamknąć na stałe (ma być
   widoczny na screenshotach ludzi).
3. Workflow `.github/workflows/pages.yml` (UWAGA: katalog `.github/`, nie `.forgejo/` —
   wykona go tylko GitHub):

   ```yaml
   name: Deploy demo to GitHub Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency: { group: pages, cancel-in-progress: true }
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: npm }
         - run: npm ci
         - run: npm run build
           env:
             VITE_BACKEND: local
             VITE_BASE: /savings-planner/
             VITE_DEMO_BANNER: 'true'
         - run: cp dist/index.html dist/404.html   # SPA fallback na Pages
         - uses: actions/upload-pages-artifact@v3
           with: { path: dist }
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

4. README: link do demo w pierwszym ekranie („**[Wypróbuj demo](https://…github.io/savings-planner/)** —
   dane nie opuszczają przeglądarki").
5. **Krok manualny (Jakub), dopisz do PR jako checklistę:**
   - Forgejo → repo → Settings → Repository → Mirror Settings → **Push mirror** na
     `https://github.com/Jakub-Mikolajczyk-pl/savings-planner.git` z GitHub PAT
     (scope `repo`), sync co push.
   - GitHub → repo Settings → Pages → Source: **GitHub Actions**.

**Pułapki:** `404.html` jest konieczny (deep-linki SPA na Pages inaczej dają 404);
wszystkie fetche zasobów MUSZĄ używać `import.meta.env.BASE_URL` (patrz 17.2);
nie hardcoduj nazwy repo poza `VITE_BASE` w workflow.

**Acceptance:** URL Pages działa; refresh na podstronie nie daje 404; „Załaduj dane demo"
wypełnia dashboard; import `.eml` (Frisco/Lisek) działa w demo; deploy na savings.lan
NIE zmienia się (workflow żyje tylko na GitHubie).

**Seed prompt:** „EPIC-17 §17.3: dodaj VITE_BASE do vite.config, DemoBanner za
VITE_DEMO_BANNER, workflow .github/workflows/pages.yml dokładnie wg dokumentu
(z 404.html), link demo w README. Branch `feat/epic-17-pages-demo`."

---

## 17.4 · Dokumenty społeczności · zależy: —

**Zakres (wszystkie pliki po angielsku, oprócz wersji PL w PRIVACY):**

1. `CONTRIBUTING.md`: dev setup (`npm install`, `bash scripts/bootstrap.sh` — hooki!,
   `npm run dev`; backend: `./gradlew bootRun` + Postgres), konwencje testów
   (vitest; fixtures przez Vite `?raw`, NIE `readFileSync` — tsconfig.app.json jest
   browserowy; backend: unit bez bazy / Testcontainers), zasady PR (branch
   `feat/epic-NN-slug`, lint+testy zielone), sekcja **„Contributing a bank format"**:
   wymagamy syntetycznego fixture'a (instrukcja anonimizacji jak w EPIC-18 §18.1)
   + link do szablonu issue.
2. `SECURITY.md`: supported = latest minor; kontakt: kupciu1@gmail.com (tytuł
   `[SECURITY] savings-planner`); 90 dni coordinated disclosure; zakres: apka,
   NIE infrastruktura użytkownika; przypomnienie „nie wystawiaj bez HTTPS/VPN".
3. `docs/PRIVACY.md` (PL + EN w jednym pliku, sekcjami): co żyje w przeglądarce
   (tryb local: wszystko w localStorage), co na Twoim serwerze (tryb API: Postgres
   w Twoim homelabie), czym jest kategoryzacja LLM (**lokalny Ollama, domyślnie
   wyłączona, `LLM_ENABLED=false`; żadnych chmurowych modeli — patrz RELEASE-2026 §3
   sprostowanie**), czego NIE ma: telemetrii, kont, cookies analitycznych, zewnętrznych
   requestów (wyjątek: jawny przycisk kursów NBP — `api.nbp.pl`). Tabela „dane → gdzie
   żyją → jak usunąć".
4. Szablony issues w `.github/ISSUE_TEMPLATE/` (GitHub i Forgejo czytają ten sam katalog):
   `bug_report.yml`, `config.yml` (blank issues off, link do dyskusji) oraz
   `bank_format_request.yml`:

   ```yaml
   name: "Bank format request"
   description: "Request support for your bank's export file"
   labels: [bank-format]
   body:
     - type: input
       id: bank
       attributes: { label: "Bank", placeholder: "e.g. Santander PL" }
       validations: { required: true }
     - type: dropdown
       id: format
       attributes: { label: "Export format", options: [CSV, PDF, XLSX, MT940, other] }
       validations: { required: true }
     - type: textarea
       id: headers
       attributes:
         label: "Column headers / first line (NO real data)"
         description: "Paste ONLY the header row. Replace any personal data with FAKE values."
     - type: textarea
       id: sample
       attributes:
         label: "One ANONYMIZED sample row"
         description: "Fake names (JAN KOWALSKI), fake account numbers, fake amounts. Keep the exact structure, separators and date format."
     - type: input
       id: encoding
       attributes: { label: "Encoding if known", placeholder: "UTF-8 / Windows-1250 / unknown" }
   ```

**Acceptance:** pliki istnieją i są podlinkowane z README (sekcja Contributing/Security/
Privacy); szablon renderuje się na GitHubie jako formularz; w treściach zero obietnic
sprzecznych z D1–D12.

**Seed prompt:** „EPIC-17 §17.4: utwórz CONTRIBUTING.md, SECURITY.md, docs/PRIVACY.md
(PL+EN) i .github/ISSUE_TEMPLATE/{bug_report,bank_format_request,config}.yml dokładnie
wg specyfikacji w dokumencie; podlinkuj z README. Branch `feat/epic-17-community-docs`."

---

## 17.5 · Nudges Telegram — dokończenie ops · zależy: — · **MANUALNY (Jakub)**

Kod jest kompletny (EPIC-16). Brakuje wartości env na CT111.

1. Telegram → @BotFather → `/newbot` → zapisz token.
2. Napisz cokolwiek do bota, potem `https://api.telegram.org/bot<TOKEN>/getUpdates`
   → odczytaj `chat.id`.
3. Na CT111: dopisz do `/opt/savings-planner/.env`:
   `TELEGRAM_BOT_TOKEN=...` i `TELEGRAM_CHAT_ID=...` (te same wartości co secrety forgejo).
4. `docker compose up -d` (restart backendu) → Ustawienia → „Wyślij testowe przypomnienie".

**Acceptance:** wiadomość testowa dochodzi; checkbox #2 z HUMAN-VERIFY EPIC-16 odhaczony.

---

## 17.6 · README na release + media · zależy: 17.3 (link demo)

**Zakres:**
1. Struktura README (kolejność sekcji): hero (1 zdanie pozycjonowania z RELEASE-2026 §1
   — PL nisza wprost) → GIF → badges (CI forgejo, license MIT, release tag) → „Try the
   demo" → What it does (jest) → **Supported banks** (tabela z EPIC-18 §18.9; na razie
   Alior CSV ✅, Velo PDF ✅, mBank/ING/PKO „planned — vote in issues") → Quick start →
   Privacy (3 zdania + link `docs/PRIVACY.md`) → reszta bez zmian.
2. Scenariusz GIF-a (≤60 s, nagrywa Jakub; narzędzie dowolne, np. ScreenToGif;
   plik `docs/screenshots/demo.gif`, optymalizuj <10 MB):
   1. Pages demo, pusty stan → klik „Załaduj dane demo" (2 s pauzy na dashboard),
   2. Majątek: wykres net worth + tabela snapshotów (scroll),
   3. Plan: karta „Co zrobić z pieniędzmi w tym miesiącu" (next best action),
   4. Transakcje: import pliku → kategorie nadane,
   5. Koszyk inflacyjny: wykres vs GUS + karta shrinkflacji.
3. Zweryfikuj aktualność screenshotów w `docs/screenshots/` (po EPIC-15/16 mogły się
   zestarzeć) — podmień te, gdzie UI się zmieniło (`node scripts/...` jeśli jest
   skrypt, inaczej ręcznie na danych demo).

**Acceptance:** test zimnego czytelnika — osoba bez kontekstu po 60 s mówi poprawnie,
co to za apka i dla kogo; wszystkie linki działają; GIF waży <10 MB.

---

## 17.7 · v1.1.0: wersja, changelog, tag · zależy: 17.1–17.6 zmergowane

1. Bump `package.json` → `1.1.0` i lustrzanie `backend/build.gradle.kts` (README
   §Versioning mówi, że wersje są mirrorowane — znajdź pole `version` w gradle).
2. `CHANGELOG.md`: sekcja `## [1.1.0]` — auth token-gate, demo button, online demo,
   community docs, README refresh (EN, zwięźle, user-facing).
3. Commit, tag `v1.1.0`, push na forgejo (mirror dociągnie GitHub via push-mirror z 17.3).

**Acceptance:** `git tag` pokazuje v1.1.0 na obu remotach; deploy zielony; demo Pages
odzwierciedla wersję.

---

## Definition of Done fazy F0

- Wszystkie chunki zmergowane, deploy na savings.lan zielony, HUMAN-VERIFY (niżej) odhaczony.
- Test „obcego człowieka": ktoś spoza projektu (żona/kolega) stawia apkę przez
  `docker compose` z README w <10 min bez pomocy.
- Od tego momentu obowiązuje rytuał tygodniowy (RELEASE-2026 §7) i wolno publikować
  posty z MARKETING-2026 (etap „feedback fishing").

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Po wyczyszczeniu localStorage savings.lan pokazuje ekran tokenu; bez tokenu żądania /api dają 401, po wpisaniu tokenu z .env apka działa jak dotąd (dane się ładują)
- [ ] Celowo zły token: komunikat błędu, dalej 401, żadnych danych; po poprawnym — wszystko wraca bez refresh
- [ ] Świeży profil przeglądarki na demo GitHub Pages: 2 kliki („Załaduj dane demo") do pełnego dashboardu, banner „dane w przeglądarce" widoczny, refresh podstrony nie daje 404
- [ ] Import .eml (Lisek/Frisco) działa na demo Pages — koszyk pokazuje produkty i wykres inflacji
- [ ] „Wyślij testowe przypomnienie" w Ustawieniach dostarcza wiadomość na Telegram (po uzupełnieniu env na CT111)
- [ ] Obcy człowiek stawia apkę z README przez docker compose w <10 minut bez Twojej pomocy i widzi pusty stan z CTA demo/import
<!-- HUMAN-VERIFY:END -->
