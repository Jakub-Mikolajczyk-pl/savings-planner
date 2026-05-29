package pl.jakubmikolajczyk.savings.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import pl.jakubmikolajczyk.savings.domain.toMonthStart
import pl.jakubmikolajczyk.savings.dto.AccountDto
import pl.jakubmikolajczyk.savings.dto.AccountSnapshotDto
import pl.jakubmikolajczyk.savings.dto.GoalDto
import pl.jakubmikolajczyk.savings.dto.LoanDto
import pl.jakubmikolajczyk.savings.dto.MortgagePlanDto
import pl.jakubmikolajczyk.savings.dto.OverridesDto
import pl.jakubmikolajczyk.savings.dto.SettingsDto
import pl.jakubmikolajczyk.savings.dto.SubscriptionDto
import pl.jakubmikolajczyk.savings.dto.UpcomingExpenseDto
import pl.jakubmikolajczyk.savings.entity.AccountSnapshotEntity
import pl.jakubmikolajczyk.savings.entity.AppSettingsEntity
import pl.jakubmikolajczyk.savings.entity.MortgagePlanEntity
import pl.jakubmikolajczyk.savings.entity.PlannerOverridesEntity
import pl.jakubmikolajczyk.savings.mapper.toDto
import pl.jakubmikolajczyk.savings.mapper.toEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import pl.jakubmikolajczyk.savings.repository.AccountSnapshotRepository
import pl.jakubmikolajczyk.savings.repository.AppSettingsRepository
import pl.jakubmikolajczyk.savings.repository.DebtRepository
import pl.jakubmikolajczyk.savings.repository.GoalRepository
import pl.jakubmikolajczyk.savings.repository.MortgagePlanRepository
import pl.jakubmikolajczyk.savings.repository.PlannerOverridesRepository
import pl.jakubmikolajczyk.savings.repository.SubscriptionRepository
import pl.jakubmikolajczyk.savings.repository.UpcomingExpenseRepository
import java.util.UUID

/*
 * SERVICES = APPLICATION LOGIC
 *
 * Controller receives HTTP. Repository talks to DB. Service is the middle layer:
 * validation that needs DB state, upsert rules, mapping, transactions.
 *
 * KOTLIN constructor injection:
 *     class AccountService(private val accounts: AccountRepository)
 *
 * JAVA comparison:
 *     private final AccountRepository accounts;
 *     public AccountService(AccountRepository accounts) { this.accounts = accounts; }
 *
 * Spring sees the single constructor and injects dependencies automatically.
 * No field @Autowired. This makes dependencies visible and test-friendly.
 *
 * INTERVIEW Q: "Why constructor injection over field injection?"
 * A: Required dependencies are explicit, can be final/read-only, and unit tests can instantiate
 *    the class directly. Field injection hides requirements and makes objects invalid before Spring runs.
 */
@Service
class AccountService(
    /*
     * KOTLIN OD ZERA, dla kogos z Javy:
     *
     * To NIE sa zwykle parametry konstruktora, ktore znikaja po utworzeniu obiektu.
     * `private val accounts: AccountRepository` oznacza naraz:
     * 1. przyjmij parametr konstruktora `accounts`,
     * 2. zapisz go w prywatnym polu klasy,
     * 3. pole jest read-only, bo jest `val`.
     *
     * Java odpowiednik:
     *
     * private final AccountRepository accounts;
     *
     * public AccountService(AccountRepository accounts, AccountSnapshotRepository snapshots) {
     *     this.accounts = accounts;
     *     this.snapshots = snapshots;
     * }
     *
     * Pytanie rekrutacyjne:
     * "Czym rozni sie val od final w Javie?"
     * Odp: Najblizej mu do finalnej referencji. Nie przestawisz `accounts` na inny obiekt,
     * ale jesli sam obiekt jest mutowalny, jego wnetrze nadal moze sie zmieniac.
     */
    private val accounts: AccountRepository,
    private val snapshots: AccountSnapshotRepository,
) {
    /*
     * JAK CZYTAC FUNKCJE W KOTLINIE:
     *
     *     fun list(): List<AccountDto> = accounts.findAll().map { it.toDto() }
     *
     * `fun`                 = deklaracja funkcji, odpowiednik metody w Javie.
     * `list()`              = nazwa i parametry.
     * `: List<AccountDto>`  = typ zwracany. W Kotlinie typ jest PO dwukropku.
     * `=`                   = expression body: funkcja zwraca wynik wyrazenia po prawej.
     * Brak `return`, bo przy `=` Kotlin sam zwraca wartosc.
     *
     * Java odpowiednik:
     *
     * public List<AccountDto> list() {
     *     return accounts.findAll().stream()
     *         .map(AccountMapper::toDto)
     *         .toList();
     * }
     *
     * `map { it.toDto() }` transforms every entity into a DTO.
     * `{ ... }` to lambda.
     * `it` to domyslna nazwa jedynego parametru lambdy.
     * Czyli `map { it.toDto() }` czytaj: "dla kazdego elementu wywolaj toDto()".
     *
     * JAVA comparison:
     *     accounts.findAll().stream().map(AccountMapper::toDto).toList()
     *
     * Kotlin collection operations are eager on List. For huge streams, use Sequence.
     *
     * INTERVIEW Q: "map vs forEach?"
     * A: map transforms and returns a new collection. forEach is for side effects and returns Unit.
     */
    fun list(): List<AccountDto> = accounts.findAll().map { it.toDto() }

    /*
     * Jednolinijkowa funkcja z parametrem:
     *
     *     fun create(dto: AccountDto): AccountDto = ...
     *
     * `dto: AccountDto` = parametr `dto` typu AccountDto.
     * W Javie piszesz odwrotnie: `AccountDto dto`.
     *
     * `accounts.save(...)` zwraca encje po zapisie.
     * `.toDto()` na koncu mapuje encje na JSON-owy kontrakt API.
     */
    fun create(dto: AccountDto): AccountDto = accounts.save(dto.toEntity()).toDto()

    /*
     * Blokowa funkcja:
     *
     * Gdy logika ma wiecej niz jedno wyrazenie, uzywamy `{ ... }` i normalnego `return`.
     * To wyglada bardziej jak Java.
     */
    fun update(id: UUID, dto: AccountDto): AccountDto {
        /*
         * `?: throw ...` is a common Kotlin guard.
         *
         * If findByIdOrNull returns null, throw NotFoundException.
         *
         * JAVA equivalent:
         *     var existing = repository.findById(id).orElseThrow(...)
         *
         * INTERVIEW Q: "Why throw in service, not controller?"
         * A: "Account not found" is an application rule. The controller should not know how
         *    every service checks existence. GlobalExceptionHandler converts it to HTTP 404.
         */
        val existing = accounts.findByIdOrNull(id) ?: throw NotFoundException("Account $id not found")
        /*
         * `dto.copy(id = id)`:
         *
         * AccountDto jest `data class`, wiec Kotlin wygenerowal metode copy().
         * Tworzy OWA kopie DTO, ale z podmienionym polem id.
         *
         * Java odpowiednik bez recordow:
         * new AccountDto(id, dto.name(), dto.bucket(), ...)
         *
         * Pytanie rekrutacyjne:
         * "Czy copy() robi deep copy?"
         * Odp: Nie. To shallow copy. Jesli DTO mialoby liste obiektow, lista bylaby ta sama
         * referencja, chyba ze sam jawnie podmienisz ja w copy(...).
         */
        return accounts.save(dto.copy(id = id).toEntity(existing)).toDto()
    }

    /*
     * Funkcja zwracajaca Unit:
     *
     * `fun delete(id: UUID)` nie ma `: Typ`, bo zwraca Unit, czyli Kotlinowy odpowiednik void.
     * Mozna napisac jawnie `: Unit`, ale zwykle sie tego nie robi.
     */
    fun delete(id: UUID) {
        if (!accounts.existsById(id)) throw NotFoundException("Account $id not found")
        accounts.deleteById(id)
    }

    fun history(accountId: UUID): List<AccountSnapshotDto> {
        /*
         * Najpierw sprawdzamy, czy konto istnieje.
         * Nie uzywamy wyniku, ale samo wywolanie rzuci 404, jesli konto nie istnieje.
         *
         * W Javie to byloby czesto:
         * repository.findById(id).orElseThrow(...)
         */
        requireAccount(accountId)
        return snapshots.findByAccountIdOrderBySnapshotDate(accountId).map { it.toDto() }
    }

    @Transactional
    fun upsertSnapshot(accountId: UUID, yearMonth: String, dto: AccountSnapshotDto): AccountSnapshotDto {
        /*
         * @Transactional:
         * The account update and snapshot save should commit together.
         *
         * INTERVIEW Q: "What happens if an exception is thrown in a @Transactional method?"
         * A: For RuntimeException, Spring marks the transaction for rollback by default.
         *
         * KOTLIN note:
         * Spring uses proxies. The kotlin("plugin.spring") Gradle plugin opens Spring classes
         * automatically because Kotlin classes are final by default.
         */
        val account = requireAccount(accountId)
        /*
         * `val` = zmienna lokalna tylko do odczytu.
         * W Javie najblizej: `final var account = ...`.
         *
         * Zasada praktyczna w Kotlinie:
         * - zaczynaj od `val`,
         * - uzyj `var` dopiero gdy naprawde musisz zmieniac wartosc zmiennej.
         */
        val snapshotDate = yearMonth.toMonthStart()
        /*
         * Idempotent upsert:
         * - find existing snapshot by unique key (account_id, snapshot_date),
         * - if missing, create one,
         * - then set the latest values and save.
         *
         * INTERVIEW Q: "PUT vs POST for upsert?"
         * A: PUT is natural when the client names the resource:
         *    /accounts/{id}/snapshots/{yearMonth}
         *    Repeating the same PUT should not create duplicates.
         */
        val snapshot = snapshots.findByAccountIdAndSnapshotDate(accountId, snapshotDate)
            ?: AccountSnapshotEntity(account = account, snapshotDate = snapshotDate)
        /*
         * `?:` to Elvis operator.
         *
         * Czytaj:
         * "wez wynik po lewej, ale jesli jest null, wez to po prawej".
         *
         * Java:
         * AccountSnapshotEntity snapshot = found != null
         *     ? found
         *     : new AccountSnapshotEntity(account, snapshotDate);
         */

        snapshot.balance = dto.balance
        snapshot.notes = dto.notes

        val openedAt = account.openedAt
        /*
         * Kotlin local val narrowing:
         * We copy nullable `account.openedAt` to local `openedAt`. Inside the if branch,
         * the compiler understands the null check better for local vals than mutable properties.
         *
         * INTERVIEW Q: "Why doesn't Kotlin always smart-cast mutable properties?"
         * A: Another thread/call could mutate a `var` property between check and use.
         *    Local vals cannot change, so smart casts are safer.
         */
        if (openedAt == null || snapshotDate.isBefore(openedAt)) {
            account.openedAt = snapshotDate
        }

        return snapshots.save(snapshot).toDto()
    }

    @Transactional
    fun deleteSnapshot(accountId: UUID, yearMonth: String) {
        requireAccount(accountId)
        snapshots.deleteByAccountIdAndSnapshotDate(accountId, yearMonth.toMonthStart())
    }

    /*
     * `private fun` = prywatna metoda pomocnicza.
     *
     * Tu znowu expression body z `=`.
     * Gdy konto istnieje, funkcja zwraca AccountEntity.
     * Gdy nie istnieje, prawa strona po `?:` rzuca wyjatek.
     *
     * Kotlin pozwala `throw` traktowac jako wyrazenie, dlatego mozna go uzyc po prawej stronie Elvis operatora.
     */
    private fun requireAccount(id: UUID) = accounts.findByIdOrNull(id) ?: throw NotFoundException("Account $id not found")
}

/*
 * The CRUD services below look repetitive on purpose.
 *
 * Teaching point:
 * Do not abstract too early. A generic BaseCrudService can reduce lines, but it often hides
 * business vocabulary and makes errors harder for a beginner to trace.
 *
 * INTERVIEW Q: "When should you introduce an abstraction?"
 * A: When duplication has stable behavior and the abstraction has a name from the domain.
 *    Similar-looking CRUD code is not automatically a good abstraction candidate.
 */
@Service
class LoanService(private val loans: DebtRepository) {
    /*
     * Te cztery funkcje sa analogiczne jak w AccountService.
     * Celowo zostaja proste i nudne, zeby latwo bylo przepisac wzorzec w glowie:
     *
     * list   -> pobierz wszystko i mapuj do DTO
     * create -> zapisz nowe DTO jako encje
     * update -> znajdz istniejace, nadpisz, zapisz
     * delete -> sprawdz istnienie, usun
     */
    fun list(): List<LoanDto> = loans.findAll().map { it.toDto() }
    fun create(dto: LoanDto): LoanDto = loans.save(dto.toEntity()).toDto()
    fun update(id: UUID, dto: LoanDto): LoanDto {
        val existing = loans.findByIdOrNull(id) ?: throw NotFoundException("Debt $id not found")
        return loans.save(dto.copy(id = id).toEntity(existing)).toDto()
    }
    fun delete(id: UUID) {
        if (!loans.existsById(id)) throw NotFoundException("Debt $id not found")
        loans.deleteById(id)
    }
}

@Service
class SubscriptionService(private val subscriptions: SubscriptionRepository) {
    fun list(): List<SubscriptionDto> = subscriptions.findAll().map { it.toDto() }
    fun create(dto: SubscriptionDto): SubscriptionDto = subscriptions.save(dto.toEntity()).toDto()
    fun update(id: UUID, dto: SubscriptionDto): SubscriptionDto {
        val existing = subscriptions.findByIdOrNull(id) ?: throw NotFoundException("Subscription $id not found")
        return subscriptions.save(dto.copy(id = id).toEntity(existing)).toDto()
    }
    fun delete(id: UUID) {
        if (!subscriptions.existsById(id)) throw NotFoundException("Subscription $id not found")
        subscriptions.deleteById(id)
    }
}

@Service
class UpcomingExpenseService(private val expenses: UpcomingExpenseRepository) {
    fun list(): List<UpcomingExpenseDto> = expenses.findAll().map { it.toDto() }
    fun create(dto: UpcomingExpenseDto): UpcomingExpenseDto = expenses.save(dto.toEntity()).toDto()
    fun update(id: UUID, dto: UpcomingExpenseDto): UpcomingExpenseDto {
        val existing = expenses.findByIdOrNull(id) ?: throw NotFoundException("Upcoming expense $id not found")
        return expenses.save(dto.copy(id = id).toEntity(existing)).toDto()
    }
    fun delete(id: UUID) {
        if (!expenses.existsById(id)) throw NotFoundException("Upcoming expense $id not found")
        expenses.deleteById(id)
    }
}

@Service
class GoalService(private val goals: GoalRepository) {
    fun list(): List<GoalDto> = goals.findAll().map { it.toDto() }
    fun create(dto: GoalDto): GoalDto = goals.save(dto.toEntity()).toDto()
    fun update(id: UUID, dto: GoalDto): GoalDto {
        val existing = goals.findByIdOrNull(id) ?: throw NotFoundException("Goal $id not found")
        return goals.save(dto.copy(id = id).toEntity(existing)).toDto()
    }
    fun delete(id: UUID) {
        if (!goals.existsById(id)) throw NotFoundException("Goal $id not found")
        goals.deleteById(id)
    }
}

@Service
class MortgagePlanService(
    private val repository: MortgagePlanRepository,
    private val objectMapper: ObjectMapper,
) {
    /*
     * Typ zwracany `MortgagePlanDto?` ma znak zapytania.
     *
     * To znaczy: funkcja moze zwrocic MortgagePlanDto ALBO null.
     *
     * Java:
     * - albo zwracasz null bez informacji w typie,
     * - albo Optional<MortgagePlanDto>.
     *
     * Kotlin wymusza obsluge null na kompilacji. Jesli wywolasz get().name bez sprawdzenia,
     * kompilator zaprotestuje.
     */
    fun get(): MortgagePlanDto? = repository.findByIdOrNull(1)?.payload?.let {
        /*
         * `?.let { ... }`
         * If payload exists, convert JsonNode -> DTO. If missing, return null.
         *
         * JAVA equivalent:
         *     return entity == null ? null : objectMapper.treeToValue(entity.payload(), MortgagePlanDto.class);
         *
         * INTERVIEW Q: "Why store singleton config with id=1?"
         * A: This is a single-tenant app. There is exactly one mortgage plan/settings row.
         *    id=1 is a simple invariant until multi-user support exists.
         */
        objectMapper.treeToValue(it, MortgagePlanDto::class.java)
    }

    fun put(dto: MortgagePlanDto): MortgagePlanDto {
        repository.save(MortgagePlanEntity(id = 1, payload = objectMapper.valueToTree(dto)))
        return dto
    }

    fun delete() {
        if (repository.existsById(1)) repository.deleteById(1)
    }
}

@Service
class SettingsService(
    private val repository: AppSettingsRepository,
    private val objectMapper: ObjectMapper,
) {
    fun get(): SettingsDto? = repository.findByIdOrNull(1)?.payload?.let {
        objectMapper.treeToValue(it, SettingsDto::class.java)
    }

    fun put(dto: SettingsDto): SettingsDto {
        repository.save(AppSettingsEntity(id = 1, payload = objectMapper.valueToTree(dto)))
        return dto
    }
}

@Service
class OverridesService(
    private val repository: PlannerOverridesRepository,
    private val objectMapper: ObjectMapper,
) {
    /*
     * `?: emptyMap()` na koncu:
     *
     * Jesli w bazie nie ma singletona overrides, API nie zwraca null.
     * Zwraca pusta mape, bo frontendowy typ Overrides to obiekt/mapa.
     */
    fun get(): OverridesDto = repository.findByIdOrNull(1)?.payload?.let {
        /*
         * TypeReference preserves generic type information at runtime.
         *
         * JVM type erasure:
         * Map<String, MonthOverrideDto> becomes just Map at runtime unless we provide
         * extra metadata. Jackson needs that metadata to deserialize nested values correctly.
         *
         * INTERVIEW Q: "What is type erasure?"
         * A: Generic type parameters are mostly removed from JVM bytecode. Runtime code often
         *    needs Class<T> or TypeReference<T> to recover enough type information.
         */
        objectMapper.convertValue(it, object : TypeReference<OverridesDto>() {})
    } ?: emptyMap()

    fun put(dto: OverridesDto): OverridesDto {
        repository.save(PlannerOverridesEntity(id = 1, payload = objectMapper.valueToTree(dto)))
        return dto
    }
}
