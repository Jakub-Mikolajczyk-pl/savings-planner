package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.dto.AccountDto
import pl.jakubmikolajczyk.savings.dto.AccountSnapshotDto
import pl.jakubmikolajczyk.savings.dto.GoalDto
import pl.jakubmikolajczyk.savings.dto.LoanDto
import pl.jakubmikolajczyk.savings.dto.MortgagePlanDto
import pl.jakubmikolajczyk.savings.dto.OverridesDto
import pl.jakubmikolajczyk.savings.dto.SettingsDto
import pl.jakubmikolajczyk.savings.dto.SubscriptionDto
import pl.jakubmikolajczyk.savings.dto.UpcomingExpenseDto
import pl.jakubmikolajczyk.savings.service.AccountService
import pl.jakubmikolajczyk.savings.service.GoalService
import pl.jakubmikolajczyk.savings.service.LoanService
import pl.jakubmikolajczyk.savings.service.MortgagePlanService
import pl.jakubmikolajczyk.savings.service.OverridesService
import pl.jakubmikolajczyk.savings.service.SettingsService
import pl.jakubmikolajczyk.savings.service.SubscriptionService
import pl.jakubmikolajczyk.savings.service.UpcomingExpenseService
import java.util.UUID

/*
 * CONTROLLERS = HTTP ADAPTERS
 *
 * They should be thin:
 * - read path/body/multipart data,
 * - call a service,
 * - return DTOs/status codes.
 *
 * They should NOT:
 * - contain SQL,
 * - expose JPA entities,
 * - implement business workflows.
 *
 * INTERVIEW Q: "What is the difference between @RestController and @Controller?"
 * A: @RestController = @Controller + @ResponseBody. Return values are serialized to JSON.
 *    @Controller is often used for server-rendered views.
 *
 * INTERVIEW Q: "@PathVariable vs @RequestBody?"
 * A: @PathVariable comes from the URL path, e.g. account id.
 *    @RequestBody is JSON payload parsed by Jackson into a DTO.
 *
 * KOTLIN syntax note:
 * `fun list() = service.list()` is an expression body. The return type is inferred.
 * For public library APIs you may prefer explicit return types; for app controllers this is readable.
 */
@RestController
@RequestMapping("/api/accounts")
class AccountController(private val service: AccountService) {
    /*
     * KLASA Z KONSTRUKTOREM W JEDNEJ LINII:
     *
     * `class AccountController(private val service: AccountService)`
     *
     * W Kotlinie primary constructor siedzi w naglowku klasy.
     * `private val service` tworzy prywatne pole, tak jak:
     *
     * private final AccountService service;
     *
     * public AccountController(AccountService service) {
     *     this.service = service;
     * }
     *
     * Spring automatycznie wstrzykuje AccountService, bo to jedyny konstruktor.
     */

    @Operation(summary = "List accounts")
    @GetMapping
    /*
     * Minimalna metoda kontrolera:
     *
     * `fun list() = service.list()`
     *
     * Nie widzisz typu zwracanego, bo Kotlin go wywnioskuje.
     * Dla nauki mozesz sobie dopisac w glowie:
     *
     * fun list(): List<AccountDto> = service.list()
     *
     * Java:
     * public List<AccountDto> list() {
     *     return service.list();
     * }
     */
    fun list() = service.list()

    @Operation(summary = "Create account")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    /*
     * @Valid triggers Jakarta Bean Validation on AccountDto.
     * The actual constraints live in DTO fields, e.g. @field:NotBlank.
     *
     * INTERVIEW Q: "Where should validation live?"
     * A: Syntactic/input validation at DTO boundary. Business validation in service/domain.
     */
    fun create(@Valid @RequestBody dto: AccountDto) = service.create(dto)

    @Operation(summary = "Update account")
    @PutMapping("/{id}")
    /*
     * Parametry z adnotacjami:
     *
     * `@PathVariable id: UUID`
     * - wez `{id}` z URL,
     * - przekonwertuj go do UUID,
     * - nazwij parametr `id`.
     *
     * `@Valid @RequestBody dto: AccountDto`
     * - przeczytaj JSON body,
     * - zbuduj AccountDto,
     * - odpal walidacje.
     *
     * Java ma typ przed nazwa:
     * update(@PathVariable UUID id, @Valid @RequestBody AccountDto dto)
     *
     * Kotlin ma nazwe przed typem:
     * update(@PathVariable id: UUID, @Valid @RequestBody dto: AccountDto)
     */
    fun update(@PathVariable id: UUID, @Valid @RequestBody dto: AccountDto) = service.update(id, dto)

    @Operation(summary = "Delete account")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: UUID) = service.delete(id)

    @Operation(summary = "List account snapshots")
    @GetMapping("/{id}/snapshots")
    fun history(@PathVariable id: UUID) = service.history(id)

    @Operation(summary = "Upsert account snapshot for month")
    @PutMapping("/{id}/snapshots/{yearMonth}")
    fun upsertSnapshot(
        @PathVariable id: UUID,
        /*
         * Spring converts UUID path variables automatically. yearMonth stays String because
         * "YYYY-MM" is not a built-in Java date type; service maps it to LocalDate.
         *
         * INTERVIEW Q: "Why PUT /snapshots/{yearMonth} instead of POST /snapshots?"
         * A: The URL identifies exactly one month snapshot. PUT can be repeated safely.
         */
        @PathVariable yearMonth: String,
        @Valid @RequestBody dto: AccountSnapshotDto,
    ) = service.upsertSnapshot(id, yearMonth, dto)

    @Operation(summary = "Delete account snapshot for month")
    @DeleteMapping("/{id}/snapshots/{yearMonth}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteSnapshot(@PathVariable id: UUID, @PathVariable yearMonth: String) = service.deleteSnapshot(id, yearMonth)
}

@RestController
@RequestMapping("/api/debts")
class LoanController(private val service: LoanService) {
    /*
     * Tu funkcje sa jednolinijkowe, bo kontroler nic nie robi poza delegacja do service.
     *
     * Jesli dopiero uczysz sie Kotlina, czytaj kazda linie tak:
     *
     * @GetMapping
     * fun list() = service.list()
     *
     * = "dla GET /api/debts wywolaj service.list() i zwroc wynik jako JSON".
     */
    @GetMapping fun list() = service.list()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: LoanDto) = service.create(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: UUID, @Valid @RequestBody dto: LoanDto) = service.update(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: UUID) = service.delete(id)
}

@RestController
@RequestMapping("/api/subscriptions")
class SubscriptionController(private val service: SubscriptionService) {
    @GetMapping fun list() = service.list()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: SubscriptionDto) = service.create(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: UUID, @Valid @RequestBody dto: SubscriptionDto) = service.update(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: UUID) = service.delete(id)
}

@RestController
@RequestMapping("/api/upcoming-expenses")
class UpcomingExpenseController(private val service: UpcomingExpenseService) {
    @GetMapping fun list() = service.list()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: UpcomingExpenseDto) = service.create(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: UUID, @Valid @RequestBody dto: UpcomingExpenseDto) = service.update(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: UUID) = service.delete(id)
}

@RestController
@RequestMapping("/api/goals")
class GoalController(private val service: GoalService) {
    @GetMapping fun list() = service.list()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: GoalDto) = service.create(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: UUID, @Valid @RequestBody dto: GoalDto) = service.update(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: UUID) = service.delete(id)
}

@RestController
@RequestMapping("/api/mortgage-plan")
class MortgagePlanController(private val service: MortgagePlanService) {
    @GetMapping
    /*
     * ResponseEntity lets us control HTTP status explicitly.
     *
     * KOTLIN chain:
     * `service.get()?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()`
     *
     * Read it as:
     * - if get() returns a plan, wrap it in 200 OK,
     * - otherwise return 404.
     *
     * JAVA comparison:
     * Optional.map(...).orElseGet(...), or a plain if/else.
     */
    fun get(): ResponseEntity<MortgagePlanDto> = service.get()?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()
    /*
     * Rozbijmy linie wyzej jak krowie na rowie:
     *
     * service.get()
     *     -> zwraca MortgagePlanDto? czyli plan albo null
     *
     * ?.let { ResponseEntity.ok(it) }
     *     -> jesli plan nie jest null, `it` to ten plan
     *     -> zwroc HTTP 200 z body
     *
     * ?: ResponseEntity.notFound().build()
     *     -> jesli po lewej wyszlo null, zwroc HTTP 404
     *
     * Java odpowiednik:
     * var plan = service.get();
     * if (plan != null) {
     *     return ResponseEntity.ok(plan);
     * }
     * return ResponseEntity.notFound().build();
     */

    @PutMapping
    fun put(@Valid @RequestBody dto: MortgagePlanDto) = service.put(dto)

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete() = service.delete()
}

@RestController
@RequestMapping("/api/settings")
class SettingsController(private val service: SettingsService) {
    @GetMapping
    fun get(): ResponseEntity<SettingsDto> = service.get()?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    @PutMapping
    fun put(@Valid @RequestBody dto: SettingsDto) = service.put(dto)
}

@RestController
@RequestMapping("/api/overrides")
class OverridesController(private val service: OverridesService) {
    /*
     * Tutaj typ zwracany jest jawny w get():
     * `fun get(): OverridesDto = service.get()`
     *
     * To samo co w Javie:
     * public OverridesDto get() { return service.get(); }
     *
     * Dobra zasada do nauki:
     * - jak funkcja jest publiczna i nieoczywista, dopisz typ zwracany,
     * - jak jest banalna i lokalna, inference jest OK.
     */
    @GetMapping fun get(): OverridesDto = service.get()
    @PutMapping fun put(@RequestBody dto: OverridesDto): OverridesDto = service.put(dto)
}
