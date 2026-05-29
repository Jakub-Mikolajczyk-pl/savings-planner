# Savings Planner Backend

Backend jest osobnym projektem Gradle w katalogu `backend/`. Root repo zostaje aplikacja Vite/React, a ten katalog trzyma API Spring Boot, migracje Flyway i testy.

## Start lokalny

1. Uruchom Postgresa:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

2. Uruchom API:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

3. Sprawdź:

- healthcheck: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

Domyślny token developerski to `dev-token`; requesty API wysyłaj z nagłówkiem `X-Api-Token: dev-token`.

## Co tu jest i po co

- `build.gradle.kts` to Gradle Kotlin DSL. W Javie często widzisz Groovy DSL albo Maven XML; tutaj konfiguracja jest kodem Kotlinowym z typami i autouzupełnianiem.
- `SavingsApplication.kt` startuje Spring Boot. Funkcja `runApplication<SavingsApplication>(*args)` to idiom Kotlinowy: krócej niż `SpringApplication.run(...)` w Javie.
- `application.yml` trzyma wspólne ustawienia, a `application-local.yml` i `application-prod.yml` różnice środowisk. Hasła produkcyjne idą wyłącznie z ENV.
- `db/migration/V1__init_finance_schema.sql` jest migracją Flyway. Baza pamięta historię zmian schematu zamiast polegać na automatycznym tworzeniu tabel przez Hibernate.
- `entity/` to klasy JPA. Celowo są zwykłymi klasami z `var`, nie `data class`: encje JPA mają cykl życia, proxy i zmienność, więc automatyczne `equals/hashCode` z `data class` potrafią narobić szkód.
- `dto/` to kontrakt JSON zgodny z `src/domain/types.ts`. API ma camelCase i miesiące jako `"YYYY-MM"`, mimo że w Postgresie trzymamy je jako `date`.
- `service/` zawiera logikę i mapowanie. Kontrolery zostają cienkie, czyli podobnie jak w klasycznym Springu w Javie.
- `config/` zawiera CORS, prostą autoryzację tokenem i wspólny JSON błędów.

## Czego się tu uczysz

- Konstruktorowa DI w Kotlinie: `class AccountService(private val repo: AccountRepository)` zamiast pól z `@Autowired`.
- Null-safety: typ `String?` wymusza obsługę braku wartości; unikamy `!!`, bo to Kotlinowy odpowiednik proszenia się o `NullPointerException`.
- Extension functions: konwersje dat są zapisane jako funkcje na `String` i `LocalDate`, np. `"2026-05".toMonthStart()`.
- `sealed interface` w importerze: kompilator zna wszystkie warianty wyniku, podobnie jak zamknięta hierarchia klas w Javie, ale z wygodniejszym `when`.
- `@field:` przy walidacji DTO: w Kotlinie adnotacja może trafić na parametr konstruktora, getter albo pole; Spring Validation czyta pole, więc piszemy `@field:NotBlank`.

