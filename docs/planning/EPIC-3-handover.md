# EPIC 3 — Handover do implementacji (Backend Kotlin / Spring Boot)

Dokument wykonawczy. Backend jako **monorepo**: nowy katalog `backend/` obok frontendu (root pozostaje Vite/React). Cel podwójny: postawić API + bazę pod EPIC 4 ORAZ **nauczyć Jakuba Kotlina** — kod ma tłumaczyć idiomy „jak krowie na rowie".

> Plan nadrzędny: `docs/planning/ROADMAP-2026.md` (EPIC 3 + schema sekcja 4 + „Zasady nauki Kotlina”). Wzór jakości: EPIC 1/2 handovery. Baza stoi: CT109 db-finance (patrz EPIC-0-infra.md).

---

## 0. Kontekst i zasady pracy

- **Repo:** `E:\repo\savings-planner`. **Branch:** `feat/epic-3-backend` (utworzony z `main` = 9a0cf5d, ma EPIC 1+2).
- **Monorepo:** backend w `backend/`, frontend zostaje w root. Nie ruszaj frontendu w tym EPIC-u (poza ewentualnym README).
- **Push do OBU remote'ów** po zielonym chunku. ⚠️ **UWAGA:** credentiale HTTP do Forgejo **wygasły** (`Authentication failed / Credentials expired`). Najpierw odśwież token/hasło dla `http://192.168.100.165:3000/jakub/savings-planner.git` (Forgejo → Settings → Applications → Generate Token, użyj jako hasło w `git`/credential manager). Do tego czasu pushuj do `origin`, a `forgejo` nadrobisz potem. Po naprawie: `git push forgejo feat/epic-3-backend`.
- **Weryfikacja przed commitem:** `cd backend && ./gradlew test` (+ `ktlint`/`detekt` jeśli dodane) zielone. Frontend bez zmian, ale upewnij się że root `npm test` dalej przechodzi.
- **Commit msg:** `feat(backend): ...`, zakończony `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Po EPIC 3:** brain-memory done log + current_focus → „EPIC 4 integracja"; karta Todoist.

### Zasady nauki Kotlina (OBOWIĄZKOWE — to jest cel projektu)
Każdy commit/PR backendowy MUSI:
1. Komentować dydaktycznie nieoczywisty Kotlin: `data class`, `sealed class`/`sealed interface`, null-safety (`?`, `?:`, `?.`, dlaczego unikamy `!!`), scope functions (`let`/`apply`/`also`/`run`/`with`), `when`, extension functions, `val` vs `var`, kolekcje (`map`/`filter`/`associateBy`), DSL Springa w Kotlinie.
2. Porównywać do Javy (którą Jakub zna): „w Javie pisałbyś X, w Kotlinie Y, bo Z".
3. W opisie PR sekcja **„Czego się tu uczysz"** (3-6 punktów).
4. Idiomatyczny Kotlin: immutability, konstruktorowa DI (bez `@Autowired` na polach), brak Lomboka (Kotlin go nie potrzebuje).

---

## 1. Stack (zatwierdzony)

| Warstwa | Wybór |
|---|---|
| JVM | Java 21 (LTS) |
| Język | Kotlin 2.x |
| Framework | Spring Boot 3.x (Spring Web, Spring Data JPA, Validation) |
| Build | Gradle Kotlin DSL (`build.gradle.kts`) |
| Migracje | Flyway (SQL w `src/main/resources/db/migration`) |
| DB | PostgreSQL (CT109 = PG17), driver `org.postgresql`, HikariCP (domyślny) |
| Docs | springdoc-openapi (Swagger UI pod `/swagger-ui.html`) |
| Testy | JUnit 5 + Spring Boot Test + MockK + Testcontainers (Postgres) |
| Serializacja | Jackson + `jackson-module-kotlin` |

Package bazowy: `pl.jakubmikolajczyk.savings`.

---

## 2. Architektura i połączenie z bazą

- **Profile Spring:**
  - `local` (dev) → Postgres z `backend/docker-compose.dev.yml` (postaw lokalnie kontener PG), `ddl-auto: validate`, Flyway migruje.
  - `prod` → CT109 `192.168.100.164:5432`, db `finance`, user `app_user`. Wszystko z ENV (`DB_HOST`, `DB_USER`, `DB_PASSWORD`) — **żadnych haseł w repo**.
- **Warstwy:** `controller` (REST + DTO) → `service` (logika) → `repository` (Spring Data JPA) → `entity`. Mapowanie DTO↔entity w warstwie service/mapperach (nie wystawiaj encji JPA bezpośrednio w API).
- **Schema Postgres:** `finance` (jak w ROADMAP sekcja 4).

---

## 3. Kontrakt API = lustro typów frontendu (KLUCZOWE dla EPIC 4)

DTO w JSON mają mieć **te same nazwy pól i kształt** co typy TS w `src/domain/types.ts`, żeby EPIC 4 był drop-in. Mapowanie:

| Frontend TS | DTO JSON (API) | Tabela DB | Uwaga konwersji |
|---|---|---|---|
| `Account {id,name,bucket,currency,openedAt?,closedAt?}` | identycznie | `finance.accounts` | `openedAt/closedAt` w API = `"YYYY-MM"`; w DB `date` (1. dzień miesiąca). Konwersja w mapperze. |
| `AccountSnapshot {accountId,yearMonth,balance,notes?}` | identycznie | `finance.account_snapshots` | `yearMonth` `"YYYY-MM"` ↔ DB `date` (1. dnia). |
| `Subscription {id,name,monthlyAmount,active,category?,nextCharge?}` | identycznie | `finance.subscriptions` | `nextCharge` = `"YYYY-MM-DD"` ↔ DB `date`. |
| `UpcomingExpense {id,name,amount,targetMonth,isPaid}` | identycznie | `finance.upcoming_expenses` | `targetMonth` `"YYYY-MM"` ↔ DB `date`. |
| `Goal {id,name,targetAmount,deadline?,priority,fixedAllocation?,currentSaved?}` | identycznie | `finance.goals` | `deadline` = `"YYYY-MM-DD"` ↔ DB `date`. |
| `Loan {id,name,remainingBalance,monthlyPayment}` | identycznie | `finance.debts` | prosty kredyt/rata. |
| `MortgagePlan {...}` (złożony) | identycznie | `finance.mortgage_plan` (jsonb singleton, id=1) | przechowuj jako jsonb payload — za złożone na kolumny. |
| `Settings {...,emergencyFundBuckets[]}` | identycznie | `finance.app_settings` (jsonb singleton) | single-tenant, jeden wiersz. |
| `Overrides {[ym]:MonthOverride}` | identycznie | `finance.planner_overrides` (jsonb singleton) | stan plannera. |

> **Decyzja:** miesiące w DB trzymamy jako `date` (1. dzień miesiąca), nie `varchar`, żeby EPIC 7 (CAGR, save-rate) mógł używać funkcji dat. API/DTO eksponują `"YYYY-MM"`. Daj helper Kotlin: `fun String.toMonthStart(): LocalDate = LocalDate.parse("$this-01")` i `fun LocalDate.toYearMonth(): String = "%04d-%02d".format(year, monthValue)`.

---

## 4. CHUNK 3.1 — Scaffold backendu

**Pliki:** `backend/build.gradle.kts`, `settings.gradle.kts`, `backend/src/main/kotlin/.../SavingsApplication.kt`, `application.yml` + `application-local.yml` + `application-prod.yml`, `backend/docker-compose.dev.yml`, `backend/Dockerfile`, `backend/README.md` („backend od zera w Kotlinie" — dydaktyczny).

Zakres:
- Gradle KTS z pluginami: `org.springframework.boot`, `io.spring.dependency-management`, `kotlin("jvm")`, `kotlin("plugin.spring")`, `kotlin("plugin.jpa")`.
- Zależności: spring-boot-starter-web, -data-jpa, -validation, -actuator, flyway-core + flyway-database-postgresql, postgresql, jackson-module-kotlin, springdoc-openapi-starter-webmvc-ui; test: spring-boot-starter-test, mockk, testcontainers (postgresql, junit-jupiter).
- `@SpringBootApplication`, healthcheck przez actuator.
- `docker-compose.dev.yml`: Postgres 17 lokalnie (port 5432, db finance, user/hasło dev).
- `Dockerfile`: multi-stage (gradle build → JRE 21 slim).

**Acceptance:** `./gradlew bootRun --args='--spring.profiles.active=local'` startuje, `/actuator/health` = UP, Swagger UI dostępny. README tłumaczy każdy plik konfiguracyjny.

---

## 5. CHUNK 3.2 — Schema (Flyway V1) + encje + repozytoria

**Pliki:** `db/migration/V1__init_finance_schema.sql`, encje w `entity/`, repozytoria w `repository/`, testy `*RepositoryTest` (Testcontainers).

- **V1 SQL:** schema `finance` + tabele wg sekcji 3 (accounts, account_snapshots [unique (account_id, snapshot_date), index na snapshot_date], debts, subscriptions, upcoming_expenses, goals, mortgage_plan jsonb, app_settings jsonb, planner_overrides jsonb). Bazuj na ROADMAP sekcja 4, ale z polami `date` jak w sekcji 3 tu.
- **Encje JPA** jako `data class`? Uwaga: JPA + Kotlin data class ma pułapki (equals/hashCode, no-arg). Zastosuj `kotlin("plugin.jpa")` (generuje no-arg) i preferuj zwykłe `class` z `var` dla encji LUB `@Entity` na klasach z domyślnymi wartościami. **Skomentuj tę pułapkę dydaktycznie** (czemu data class bywa zły dla encji JPA).
- Repozytoria: `interface XRepository : JpaRepository<XEntity, UUID>`. Dla snapshotów: metoda `findByAccountIdOrderBySnapshotDate`.
- jsonb: mapuj przez `@JdbcTypeCode(SqlTypes.JSON)` (Hibernate 6) na typ Kotlin/`String`/`JsonNode`.

**Acceptance:** Flyway migruje na czystej bazie (Testcontainers); testy CRUD repozytoriów zielone; `ddl-auto: validate` przechodzi (encje zgodne ze schematem).

---

## 6. CHUNK 3.3 — REST API (CRUD)

**Pliki:** `controller/`, `service/`, `dto/`, `mapper/`, testy `*ControllerTest` (MockMvc/`@WebMvcTest` + service test).

Endpointy (prefix `/api`), DTO wg sekcji 3:
- `GET/POST /accounts`, `PUT/DELETE /accounts/{id}`, `GET /accounts/{id}/snapshots` (history), `PUT /accounts/{id}/snapshots/{yearMonth}` (upsert), `DELETE .../{yearMonth}`.
- `GET/POST /debts`, `PUT/DELETE /debts/{id}`.
- `GET/POST /subscriptions`, `PUT/DELETE /subscriptions/{id}`.
- `GET/POST /upcoming-expenses`, `PUT/DELETE /upcoming-expenses/{id}`.
- `GET/POST /goals`, `PUT/DELETE /goals/{id}`.
- `GET/PUT /mortgage-plan` (singleton; PUT upsert, DELETE czyści).
- `GET/PUT /settings` (singleton), `GET/PUT /overrides` (singleton).
- Walidacja `@Valid` na DTO (jakarta validation: `@field:NotBlank`, `@field:Positive` itp. — **uwaga na `@field:` w Kotlinie, skomentuj czemu**).
- OpenAPI: opisz endpointy adnotacjami springdoc.

**Acceptance:** testy happy-path + walidacja (400 na złe dane) dla każdego zasobu; Swagger pokazuje pełne API; kształt JSON zgodny z typami frontu (sekcja 3).

---

## 7. CHUNK 3.4 — Silnik importera CSV (multi-year)

**Pliki:** `import/CsvAccountImporter.kt` (serwis), `import/ImportModels.kt` (sealed class wyników), `controller/ImportController.kt`, testy z fixture'ami CSV (`src/test/resources/finanse-2022.csv`...).

Logika (mirror EPIC-1-handover sekcja importera, ale w Kotlinie — patrz ROADMAP sekcja 5):
1. Wejście: plik CSV + mapping JSON (kolumna → `accountId | newAccount(bucket) | skip`) + rok.
2. Parser daty `<MiesiącPL> (DD.MM)` + rok → `LocalDate` (mapa polskich nazw miesięcy). Granularność miesięczna → `snapshot_date` = 1. dnia.
3. Upsert kont (po nazwie/mappingu) + snapshotów (idempotentnie po (account, month)). `opened_at` = min(date).
4. Lifecycle: konto z ciszą ≥3 miesiące w nowszych danych → flaga w wyniku (propozycja `closed_at`).
5. Wynik jako `sealed interface ImportResult { data class Success(...) ; data class PartialWithWarnings(...) }` — **skomentuj sealed class dydaktycznie**.
- Endpoint: `POST /api/import/account-snapshots` (multipart: plik + mapping). Idempotentny.

**Acceptance:** import fixture 2022–2024 tworzy konta + snapshoty, wykrywa lifecycle, jest idempotentny (ponowny import nie duplikuje); testy jednostkowe parsera (polskie miesiące, carry przez lata) i integracyjny endpointu.

---

## 8. CHUNK 3.5 — Hardening

**Pliki:** `config/` (CORS, security, exception handler), `application-*.yml`.

- `@RestControllerAdvice` → spójny JSON błędów (`{timestamp, status, error, message, path}`), mapowanie walidacji (400), not-found (404).
- CORS: zezwól na origin frontu (`http://savings.lan`, `http://localhost:5173` dla dev) z ENV.
- Auth single-tenant: prosty statyczny token w nagłówku (`X-Api-Token`) porównywany z ENV `API_TOKEN`, albo Spring Security basic auth (jeden user z ENV). Bez OAuth/JWT — single-tenant. **Brak tokena/zły → 401.**
- Logowanie (SLF4J), dev seed (profil `local`) — kilka przykładowych kont/snapshotów.

**Acceptance:** błędy zwracają sensowny JSON; nieautoryzowany request = 401; CORS pozwala frontowi; `local` ma seed.

---

## 9. Definition of Done (EPIC 3)

- [ ] 3.1–3.5 z acceptance spełnionym.
- [ ] `./gradlew test` zielone (repo Testcontainers + controller + importer). Root `npm test` nadal zielony.
- [ ] Swagger UI pokazuje pełne API; kształt JSON zgodny z `src/domain/types.ts` (sekcja 3).
- [ ] Flyway V1 migruje na czystej bazie; `prod` profil łączy z CT109 przez ENV (zero sekretów w repo).
- [ ] Backend buduje się do obrazu Docker (`backend/Dockerfile`).
- [ ] Każdy PR ma sekcję „Czego się tu uczysz" (Kotlin/Spring).
- [ ] Branch wypchnięty do `origin` (+ `forgejo` po naprawie creddów).
- [ ] PR do `main`; po merge ujednolicić oba remote'y na ten sam SHA (ostatnio rozjazd przez merge commit GitHub — patrz sekcja 10).
- [ ] brain-memory + Todoist zaktualizowane.

## 10. Workflow remote'ów (żeby przestał się powtarzać rozjazd)
Każdy epic origin/main dostaje merge commit z PR (GitHub), a forgejo/main zostaje liniowo z tyłu → rozjazd. **Standard po merge PR na GitHub:** `git fetch origin && git push forgejo origin/main:main` (fast-forward, bez force). Tak oba `main` trzymają ten sam SHA.

## 11. Świadome NIE w EPIC 3
- Bez podłączania frontu do API (to EPIC 4 — feature flag, sync, source of truth).
- Bez CI/CD (EPIC 5 — `.forgejo/workflows`, dockeryzacja+deploy).
- Bez multi-tenant (single-tenant, jeden user).
- Bez przeliczeń FX/krypto (salda w PLN; krypto zamknięte).
- Bez analiz CAGR/FIRE (EPIC 7) — ale schemat `date` ma to umożliwić.
