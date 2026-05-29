package pl.jakubmikolajczyk.savings.mapper

import pl.jakubmikolajczyk.savings.domain.toIsoDate
import pl.jakubmikolajczyk.savings.domain.toMonthStart
import pl.jakubmikolajczyk.savings.domain.toYearMonth
import pl.jakubmikolajczyk.savings.dto.AccountBucket
import pl.jakubmikolajczyk.savings.dto.AccountDto
import pl.jakubmikolajczyk.savings.dto.AccountSnapshotDto
import pl.jakubmikolajczyk.savings.dto.GoalDto
import pl.jakubmikolajczyk.savings.dto.LoanDto
import pl.jakubmikolajczyk.savings.dto.SubscriptionDto
import pl.jakubmikolajczyk.savings.dto.UpcomingExpenseDto
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.entity.AccountSnapshotEntity
import pl.jakubmikolajczyk.savings.entity.DebtEntity
import pl.jakubmikolajczyk.savings.entity.GoalEntity
import pl.jakubmikolajczyk.savings.entity.SubscriptionEntity
import pl.jakubmikolajczyk.savings.entity.UpcomingExpenseEntity

/*
 * MAPPERS = BOUNDARY BETWEEN API AND DATABASE
 *
 * These are extension functions, so call sites read naturally:
 *     entity.toDto()
 *     dto.toEntity(existing)
 *
 * JAVA comparison:
 * In Java you might write a Mapper class with static methods:
 *     AccountMapper.toDto(entity)
 *
 * Why not MapStruct?
 * MapStruct is great in larger apps, but here the interesting part is date conversion
 * (`YYYY-MM` <-> LocalDate). Hand-written mappers keep the learning visible.
 *
 * INTERVIEW Q: "Where should mapping live?"
 * A: At boundaries: controller/service layer, not inside JPA entities. Entities should not
 *    know HTTP JSON details; DTOs should not know database details.
 */
/*
 * EXTENSION FUNCTION OD ZERA:
 *
 * `fun AccountEntity.toDto() = AccountDto(...)`
 *
 * Czytaj:
 * - `fun` = funkcja,
 * - `AccountEntity.` przed nazwa = receiver, czyli "ta funkcja wyglada jak metoda AccountEntity",
 * - `toDto()` = nazwa funkcji,
 * - `=` = zwroc wynik wyrazenia po prawej.
 *
 * Wywolanie:
 *     account.toDto()
 *
 * Java mental model:
 *     AccountMappers.toDto(account)
 *
 * To NIE dodaje prawdziwej metody do AccountEntity. Kompilator robi z tego statyczna funkcje.
 */
fun AccountEntity.toDto() = AccountDto(
    /*
     * Named arguments:
     *
     * AccountDto(
     *     id = id,
     *     name = name,
     * )
     *
     * Po lewej jest nazwa parametru konstruktora DTO.
     * Po prawej jest wartosc z encji.
     *
     * `id = id` wyglada dziwnie na start, ale czytaj:
     * "parametr DTO o nazwie id ustaw na this.id z AccountEntity".
     *
     * Java:
     * new AccountDto(entity.getId(), entity.getName(), ...)
     *
     * Named arguments sa czytelniejsze przy wielu polach tego samego typu.
     */
    id = id,
    name = name,
    bucket = AccountBucket.valueOf(bucket),
    currency = currency,
    openedAt = openedAt?.toYearMonth(),
    closedAt = closedAt?.toYearMonth(),
)

fun AccountDto.toEntity(existing: AccountEntity? = null) = (existing ?: AccountEntity()).also {
    /*
     * Receiver w tej funkcji to AccountDto.
     * To znaczy, ze w ciele funkcji `name`, `bucket`, `openedAt` oznaczaja pola DTO,
     * nawet jesli nie piszemy `this.name`.
     *
     * `(existing ?: AccountEntity())`:
     * - jesli service przekazal istniejaca encje, aktualizujemy ja,
     * - jesli nie, tworzymy nowa encje.
     */
    /*
     * `also { ... }` is a Kotlin scope function.
     *
     * Meaning:
     * - It receives the object as `it`.
     * - It returns the same object after the block.
     *
     * JAVA-ish equivalent:
     *     AccountEntity target = existing != null ? existing : new AccountEntity();
     *     target.setName(name);
     *     return target;
     *
     * INTERVIEW Q: "also vs apply?"
     * A: `apply` uses `this` inside the block and is common for object configuration.
     *    `also` uses `it` and is nice when you want to make side effects explicit.
     */
    it.id = id ?: it.id
    /*
     * Elvis operator `?:`
     *
     * `id ?: it.id` means: if id is not null, use id; otherwise keep existing id.
     *
     * JAVA equivalent:
     *     id != null ? id : it.getId()
     *
     * INTERVIEW Q: "What is the Elvis operator in Kotlin?"
     * A: A compact null fallback operator.
     */
    it.name = name
    it.bucket = bucket.name
    it.currency = currency
    it.openedAt = openedAt?.toMonthStart()
    it.closedAt = closedAt?.toMonthStart()
}

fun AccountSnapshotEntity.toDto() = AccountSnapshotDto(
    accountId = account.id,
    yearMonth = snapshotDate.toYearMonth(),
    balance = balance,
    notes = notes,
)

fun DebtEntity.toDto() = LoanDto(id = id, name = name, remainingBalance = remainingBalance, monthlyPayment = monthlyPayment)

/*
 * Ta funkcja jest jednowierszowa, ale rozwinieta mentalnie wyglada tak:
 *
 * fun DebtEntity.toDto(): LoanDto {
 *     return LoanDto(
 *         id = this.id,
 *         name = this.name,
 *         remainingBalance = this.remainingBalance,
 *         monthlyPayment = this.monthlyPayment,
 *     )
 * }
 *
 * Kotlin pozwala skrocic ja do expression body, bo nie ma zadnej logiki pobocznej.
 */

fun LoanDto.toEntity(existing: DebtEntity? = null) = (existing ?: DebtEntity()).also {
    /*
     * `it` w also to encja DebtEntity, nie DTO.
     *
     * W tej funkcji masz dwa "swiaty":
     * - pola bez prefixu (`id`, `name`) pochodza z LoanDto, bo LoanDto jest receiverem,
     * - `it.id`, `it.name` to pola encji, ktora konfigurujemy.
     *
     * To jest wygodne, ale na poczatku moze byc mylace. Czytaj `it` jako `targetEntity`.
     */
    it.id = id ?: it.id
    it.name = name
    it.remainingBalance = remainingBalance
    it.monthlyPayment = monthlyPayment
    it.kind = "installment"
}

fun SubscriptionEntity.toDto() = SubscriptionDto(
    id = id,
    name = name,
    monthlyAmount = monthlyAmount,
    active = active,
    category = category,
    nextCharge = nextCharge?.toString(),
)

fun SubscriptionDto.toEntity(existing: SubscriptionEntity? = null) = (existing ?: SubscriptionEntity()).also {
    it.id = id ?: it.id
    it.name = name
    it.monthlyAmount = monthlyAmount
    it.active = active
    it.category = category
    /*
     * Safe-call operator `?.`
     *
     * `nextCharge?.toIsoDate()` means:
     * - if nextCharge is null, result is null,
     * - otherwise call toIsoDate().
     *
     * JAVA equivalent:
     *     nextCharge == null ? null : toIsoDate(nextCharge)
     */
    it.nextCharge = nextCharge?.toIsoDate()
}

fun UpcomingExpenseEntity.toDto() = UpcomingExpenseDto(
    id = id,
    name = name,
    amount = amount,
    targetMonth = targetMonth.toYearMonth(),
    isPaid = isPaid,
)

fun UpcomingExpenseDto.toEntity(existing: UpcomingExpenseEntity? = null) = (existing ?: UpcomingExpenseEntity()).also {
    it.id = id ?: it.id
    it.name = name
    it.amount = amount
    it.targetMonth = targetMonth.toMonthStart()
    it.isPaid = isPaid
}

fun GoalEntity.toDto() = GoalDto(
    id = id,
    name = name,
    targetAmount = targetAmount,
    deadline = deadline?.toString(),
    priority = priority,
    fixedAllocation = fixedAllocation,
    currentSaved = currentSaved,
)

fun GoalDto.toEntity(existing: GoalEntity? = null) = (existing ?: GoalEntity()).also {
    it.id = id ?: it.id
    it.name = name
    it.targetAmount = targetAmount
    it.deadline = deadline?.toIsoDate()
    it.priority = priority
    it.fixedAllocation = fixedAllocation
    it.currentSaved = currentSaved
}
