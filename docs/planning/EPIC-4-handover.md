# EPIC 4 — Handover do implementacji (Integracja front ↔ backend)

Dokument wykonawczy. Podpięcie React do backendu Kotlin/Spring Boot (EPIC 3, w `main`). Frontend dotąd był czysto local (Zustand+localStorage); EPIC 4 dodaje warstwę API, sync i tryb „backend jako źródło prawdy" — **za feature flagą**, żeby tryb local dalej działał.

> Nadrzędne: `docs/planning/ROADMAP-2026.md` (EPIC 4). Kontrakt API: backend `backend/src/main/kotlin/.../controller` + `dto/FinanceDtos.kt` (już w `main`). Wzór konwencji: EPIC 1–3 handovery.

---

## 0. Kontekst i zasady pracy

- **Repo:** `E:\repo\savings-planner`. **Branch:** `feat/epic-4-integration` (z `main` = 1584118, ma EPIC 1–3).
- To **frontend** (root, React/TS). Backend już gotowy — nie zmieniaj go, chyba że znajdziesz realny bug w kontrakcie (wtedy mały, opisany commit w `backend/`).
- **Push do OBU** po zielonym chunku: `git push origin feat/epic-4-integration` + `git push forgejo feat/epic-4-integration`. (Forgejo auth bywa migotliwy — retry/odśwież token.)
- Przed commitem: `npm run lint && npm run build && npm test` zielone.
- **Merge robimy lokalnie i pushujemy do obu** (patrz CONVENTIONS — rebase Forgejo vs merge GitHub się rozjeżdża). Nie klikać „merge" w web UI.
- Commit: `feat(api): ...` / `feat(sync): ...` + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Po EPIC 4: brain-memory done log + current_focus → „EPIC 5 CI/CD"; karta Todoist.

---

## 1. Kontrakt backendu (stan faktyczny z `main`)

- **Base path:** `/api`. **Auth:** nagłówek `X-Api-Token: <token>` na KAŻDYM `/api/**` (brak/zły → 401). `OPTIONS`, `/actuator/health`, `/swagger-ui.html`, `/v3/api-docs/**` otwarte.
- **CORS:** dozwolone originy z ENV `CORS_ALLOWED_ORIGINS` (domyślnie `http://localhost:5173`, `http://savings.lan`), nagłówki `Content-Type` + `X-Api-Token`, `allowCredentials=false`.
- **JSON:** `non_null` (pola null pomijane). Kwoty = BigDecimal → liczby JSON (frontend `number` OK). `id` = UUID (frontend `crypto.randomUUID()` jest zgodny).

**Endpointy** (DTO = lustro `src/domain/types.ts`):

| Zasób | Metody |
|---|---|
| accounts | `GET /api/accounts` · `POST /api/accounts` (201, `id` opcjonalne) · `PUT /api/accounts/{id}` · `DELETE /api/accounts/{id}` |
| snapshots | `GET /api/accounts/{id}/snapshots` · `PUT /api/accounts/{id}/snapshots/{yearMonth}` (upsert) · `DELETE /api/accounts/{id}/snapshots/{yearMonth}` |
| debts (Loan) | `GET/POST /api/debts` · `PUT/DELETE /api/debts/{id}` |
| subscriptions | `GET/POST /api/subscriptions` · `PUT/DELETE /api/subscriptions/{id}` |
| upcoming-expenses | `GET/POST /api/upcoming-expenses` · `PUT/DELETE /api/upcoming-expenses/{id}` |
| goals | `GET/POST /api/goals` · `PUT/DELETE /api/goals/{id}` |
| mortgage-plan (singleton) | `GET` (404 gdy brak) · `PUT` · `DELETE` |
| settings (singleton) | `GET` (404 gdy nieustawione) · `PUT` |
| overrides (singleton) | `GET` (zwraca `{}`) · `PUT` |
| import | `POST /api/import/account-snapshots` (multipart: `file` + `mapping` = `CsvImportMappingDto`) |

DTO różnice vs frontend (drobne): `Settings.emergencyFundBuckets` wymagane niepuste; `Goal.priority` ≥ 1; `Subscription/UpcomingExpense/Goal/Loan` kwoty `@Positive`.

---

## 2. Kluczowe założenia

1. **Feature flag `VITE_BACKEND`** = `local` (domyślnie, zachowanie jak dziś) | `api` (czyta/pisze do backendu). Tryb `local` MUSI dalej działać bez backendu.
2. **Źródłem prawdy w trybie `api` jest backend.** Zustand staje się cache hydratowanym z API; localStorage persist zostaje tylko dla trybu `local` (albo jako offline cache — patrz 4.3).
3. **Bootstrap bez kolizji id:** przy pierwszym wysłaniu danych do pustego backendu wysyłaj encje BEZ `id` (backend wygeneruje), potem **przeładuj stan z backendu**, żeby front przejął backendowe id. Nie zakładaj, że POST z własnym id się powiedzie idempotentnie.
4. **Single-user, LAN.** Obsługa błędów minimalna ale obecna (toast/log + brak cichych utrat). Bez optimistic-locking, bez konfliktów wieloosobowych.

---

## 3. CHUNK 4.1 — Warstwa API client + feature flag

**Pliki:** `src/api/client.ts`, `src/api/types.ts` (lub reuse `domain/types.ts`), `src/config.ts`, `.env.example`.

- `.env.example`: `VITE_BACKEND=local`, `VITE_API_BASE_URL=http://localhost:8080`, `VITE_API_TOKEN=dev-token`. (Prod LAN: `VITE_API_BASE_URL=http://savings.lan`, token = `API_TOKEN` backendu.)
- `client.ts`: cienki wrapper `fetch` dodający `X-Api-Token` i base URL; rzuca typowany błąd na !ok; helpery `get/post/put/del`. Typowane funkcje per zasób (np. `accountsApi.list()/create()/update()/remove()`, `snapshotsApi.history(accountId)/upsert(...)/remove(...)`, `mortgageApi.get()` zwraca `MortgagePlan | undefined` (404→undefined), `settingsApi.get()` (404→undefined), `importApi.accountSnapshots(file, mapping)`).
- Flaga: `export const BACKEND_MODE = import.meta.env.VITE_BACKEND ?? 'local'`. W trybie `local` klient nie jest wołany.

**Acceptance:** w trybie `local` zero zmian zachowania; w trybie `api` `accountsApi.list()` zwraca dane z działającego backendu (przetestuj ręcznie z `npm run dev` + lokalny backend); typy klienta zgodne z DTO (sekcja 1).

---

## 4. CHUNK 4.2 — Sync bootstrap + import CSV

**Pliki:** rozszerz `src/components/ui/AdvancedSettings.tsx` (lub nowy `src/components/sync/`), nowy `src/components/accounts/ImportCsvDialog.tsx`.

- **Przycisk „Wyślij dane do bazy" (bootstrap):** widoczny w trybie `api`. Algorytm: sprawdź czy backend pusty (`GET` kolekcji); jeśli tak → wyślij lokalne encje BEZ id (POST/PUT singletony: settings, overrides, mortgage), snapshoty przez upsert PUT; po wszystkim **przeładuj stan z backendu** (front przejmuje backendowe id). Jeśli backend NIE pusty → ostrzeż i nie duplikuj.
- **Import CSV (multi-year):** dialog upload pliku → wybór roku + mapowanie kolumn (`CsvImportMappingDto`: per kolumna `action: "existing"|"new"|"skip"`, `accountId|name+bucket`) → `POST /api/import/account-snapshots` → po sukcesie przeładuj konta+snapshoty. Walidacja po stronie UI minimalna; backend zwraca wynik (utworzone/lifecycle).

**Acceptance:** bootstrap z pustego backendu przenosi cały lokalny stan i front pokazuje te same liczby po przeładowaniu; import jednego CSV tworzy konta+snapshoty; ponowny bootstrap nie duplikuje.

---

## 5. CHUNK 4.3 — Backend jako źródło prawdy

**Pliki:** warstwa pośrednia między store a API — sugerowane `src/store/sync.ts` lub refactor akcji store; `src/App.tsx` (hydratacja na starcie).

- **Hydratacja:** w trybie `api`, na mount aplikacji pobierz wszystko (`accounts`, snapshots per account lub zbiorczo, debts, subs, upcoming, goals, mortgage(404→undef), settings(404→push domyślnych), overrides) → wypełnij Zustand. Pokaż stan ładowania.
- **Mutacje:** każda akcja zmieniająca dane woła odpowiedni endpoint (add→POST, update→PUT, remove→DELETE, snapshot→PUT). Wzorzec: **optimistic update** (zmień Zustand od razu, w tle wyślij; na błędzie rollback + komunikat). Zustand pozostaje cache.
- **Tryb `local`:** bez zmian — persist do localStorage, zero wywołań API.
- Rozważ cienką abstrakcję „repository" wybieraną wg `BACKEND_MODE` (local = mutacje Zustand+persist; api = API + cache), żeby komponenty nie miały `if (mode)` wszędzie.

**Acceptance:** w trybie `api` odświeżenie strony ładuje stan z bazy (nie z localStorage); dodanie/edycja/usunięcie konta, snapshota, celu, abonamentu itd. utrwala się w backendzie (widać po reloadzie); tryb `local` nadal w pełni działa offline.

---

## 6. Definition of Done

- [ ] 4.1–4.3 z acceptance.
- [ ] `npm run lint && npm run build && npm test` zielone.
- [ ] Tryb `local` działa bez backendu (regres zero); tryb `api` czyta/pisze do backendu.
- [ ] `.env.example` + krótka sekcja w README jak przełączyć tryb i podać token.
- [ ] Ręczny test E2E: `npm run dev` (VITE_BACKEND=api) + backend `local` → bootstrap, import CSV, CRUD, reload zachowuje stan.
- [ ] Branch na `origin` + `forgejo`; merge lokalny → push do obu; brain-memory + Todoist zaktualizowane.

## 7. Świadome NIE w EPIC 4

- Bez CI/CD i deployu (EPIC 5 — `.forgejo/workflows`, dockeryzacja front+back, compose na CT111).
- Bez PWA/offline-sync konfliktów (EPIC 6).
- Bez realtime/websocketów — proste request/response wystarcza dla single-user.
- Bez migracji istniejących danych produkcyjnych poza bootstrapem/importem CSV.
