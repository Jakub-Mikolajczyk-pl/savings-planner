package pl.jakubmikolajczyk.savings.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import java.math.BigDecimal
import java.util.UUID

/*
 * DTO FILE = PUBLIC API CONTRACT
 *
 * DTO means Data Transfer Object. These classes are the JSON shape used by React.
 * They are deliberately separate from JPA entities:
 *
 * - DTOs speak frontend language: camelCase, "YYYY-MM", optional fields.
 * - Entities speak database language: dates, schema tables, JPA annotations.
 *
 * INTERVIEW Q: "Why not return JPA entities directly from controllers?"
 * A: Because entities are persistence objects, not API contracts. Returning them can leak
 *    lazy relations, internal columns, schema changes, and weird serialization behavior.
 *    DTOs let us version/shape the API independently from the database.
 *
 * KOTLIN data class:
 * `data class` generates equals(), hashCode(), toString(), copy(), componentN().
 * This is excellent for immutable-ish value carriers like DTOs.
 *
 * JAVA comparison:
 * Java 21 record is the closest equivalent:
 *     public record AccountDto(UUID id, String name, ...) {}
 *
 * Difference:
 * - Java records are immutable by design.
 * - Kotlin data classes can use `val` (read-only property) or `var` (mutable property).
 *   We use `val` here because request/response objects should not be mutated after creation.
 */

/*
 * Kotlin enum names are serialized by Jackson as strings by default.
 * We intentionally use lowercase enum constants because the TypeScript union is:
 * 'cash' | 'investment' | 'retirement' | 'down_payment' | 'crypto'
 *
 * INTERVIEW Q: "Enum vs string literal union?"
 * A: Backend needs runtime values, validation, and OpenAPI docs, so enum is useful.
 *    Frontend TypeScript can use a string union because it is erased at runtime.
 */
enum class AccountBucket {
    accounts,
    safety_cushion,
    retirement,
    renovation,
    investments,
    vacation,
    emergency_fund,
}

data class AccountDto(
    /*
     * JAK CZYTAC DATA CLASS OD ZERA:
     *
     * data class AccountDto(
     *     val id: UUID? = null,
     *     @field:NotBlank val name: String,
     *     ...
     * )
     *
     * `data class` = klasa do przenoszenia danych. Kotlin generuje boilerplate.
     *
     * Kazda linia `val name: String` w primary constructor robi dwie rzeczy:
     * 1. przyjmuje parametr konstruktora,
     * 2. tworzy publiczna read-only property `name`.
     *
     * Java record podobnie:
     * public record AccountDto(UUID id, String name, ...) {}
     *
     * `= null` albo `= "PLN"` to wartosc domyslna.
     * Dzieki temu przy tworzeniu DTO mozna pominac pole:
     *
     * AccountDto(name = "mBank", bucket = AccountBucket.cash)
     *
     * Pytanie rekrutacyjne:
     * "Co Kotlin generuje dla data class?"
     * Odp: equals, hashCode, toString, copy, componentN.
     */
    /*
     * `UUID?` means "UUID or null".
     *
     * KOTLIN NULL-SAFETY:
     * - `UUID` cannot be null.
     * - `UUID?` can be null.
     *
     * JAVA comparison:
     * Java lets any reference be null unless you add Optional/annotations.
     * Kotlin makes the possibility visible in the type system.
     *
     * Here id is nullable because POST /accounts can omit it. The service generates one.
     */
    val id: UUID? = null,
    /*
     * IMPORTANT KOTLIN + VALIDATION:
     * `@field:NotBlank` tells Kotlin: put the annotation on the generated backing field.
     *
     * Without `@field:`, the annotation may land on the constructor parameter, and
     * Jakarta Bean Validation might not see it.
     *
     * INTERVIEW Q: "Why @field:NotBlank in Kotlin but @NotBlank in Java?"
     * A: Java has one obvious field/parameter target in typical POJOs. Kotlin primary
     *    constructor properties generate multiple JVM elements: parameter, field, getter.
     *    The use-site target selects the one the framework reads.
     */
    @field:NotBlank val name: String,
    @field:NotNull val bucket: AccountBucket,
    @field:NotBlank val currency: String = "PLN",
    val openedAt: String? = null,
    val closedAt: String? = null,
)

data class AccountSnapshotDto(
    val accountId: UUID,
    /*
     * The API uses "YYYY-MM" because that is what the frontend domain model already uses.
     * The database stores this as date = first day of month for analytics later.
     *
     * Recruiter angle:
     * This is a classic boundary-mapping problem. Keep the API ergonomic, but store data
     * in a query-friendly type.
     */
    @field:NotBlank val yearMonth: String,
    @field:NotNull val balance: BigDecimal,
    val notes: String? = null,
)

data class LoanDto(
    val id: UUID? = null,
    @field:NotBlank val name: String,
    @field:Positive val remainingBalance: BigDecimal,
    @field:Positive val monthlyPayment: BigDecimal,
)

/*
 * BigDecimal instead of Double:
 *
 * INTERVIEW Q: "Why should money not be represented as floating point?"
 * A: Double/Float are binary floating-point and cannot exactly represent many decimal
 *    fractions. BigDecimal stores decimal values precisely, which matters for money.
 *
 * JAVA comparison:
 * Same rule in Java. Kotlin's BigDecimal is java.math.BigDecimal.
 */
data class SubscriptionDto(
    val id: UUID? = null,
    @field:NotBlank val name: String,
    @field:Positive val monthlyAmount: BigDecimal,
    val active: Boolean = true,
    val category: String? = null,
    val nextCharge: String? = null,
    val billingPeriod: String? = null,
    val billingAmount: BigDecimal? = null,
    val shared: Boolean? = null,
    val shareCount: Int? = null,
)

data class UpcomingExpenseDto(
    val id: UUID? = null,
    @field:NotBlank val name: String,
    @field:Positive val amount: BigDecimal,
    @field:NotBlank val targetMonth: String,
    val isPaid: Boolean = false,
)

data class GoalDto(
    val id: UUID? = null,
    @field:NotBlank val name: String,
    @field:Positive val targetAmount: BigDecimal,
    val deadline: String? = null,
    @field:Min(1) val priority: Int,
    val fixedAllocation: BigDecimal? = null,
    val currentSaved: BigDecimal? = BigDecimal.ZERO,
)

data class MortgageOneTimeOverpaymentDto(
    @field:NotBlank val id: String,
    @field:NotBlank val yearMonth: String,
    @field:Positive val amount: BigDecimal,
)

enum class MortgageOverpaymentMode {
    shortenTerm,
    reducePayment,
}

data class MortgagePlanDto(
    @field:NotBlank val id: String,
    @field:NotBlank val name: String,
    @field:Positive val principal: BigDecimal,
    @field:Positive val annualInterestRate: BigDecimal,
    @field:Min(1) val originalTermMonths: Int,
    @field:Min(1) val termMonths: Int,
    val monthlyOverpayment: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val overpaymentMode: MortgageOverpaymentMode,
    @field:Valid val oneTimeOverpayments: List<MortgageOneTimeOverpaymentDto> = emptyList(),
    /*
     * Nullable optional numbers:
     * `BigDecimal? = null` means the JSON field can be omitted or null.
     *
     * Avoid `!!` later. If a value is optional, code should branch explicitly:
     *     dto.refinanceCost?.let { cost -> ... }
     *
     * INTERVIEW Q: "What does `?.let {}` do?"
     * A: It runs the block only when the receiver is non-null. It is Kotlin's compact
     *    null-safe transformation pattern.
     */
    val refinanceAnnualInterestRate: BigDecimal? = null,
    val refinanceCost: BigDecimal? = null,
)

enum class IkzeParticipantRole {
    employee,
    entrepreneur,
}

data class IkzePlanEntryDto(
    @field:NotBlank val id: String,
    @field:Min(2000) val year: Int,
    @field:NotBlank val ownerName: String,
    @field:NotNull val role: IkzeParticipantRole,
    @field:NotNull val annualLimit: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val contributedAmount: BigDecimal = BigDecimal.ZERO,
    @field:Min(0) val payoutsLeft: Int = 0,
)

data class SettingsDto(
    @field:NotNull val monthlyIncome: BigDecimal,
    @field:NotNull val monthlyExpenses: BigDecimal,
    @field:NotBlank val startMonth: String,
    @field:Min(1) val horizonMonths: Int,
    @field:NotEmpty val emergencyFundBuckets: List<AccountBucket>,
    // Cel poduszki = tyle miesięcy kosztów; cel funduszu = stała kwota docelowa.
    // Defaulty pozwalają zdeserializować stare ustawienia bez tych pól.
    @field:Min(1) val safetyCushionMonths: Int = 6,
    @field:NotNull val emergencyFundTarget: BigDecimal = BigDecimal("10000"),
    @field:Valid val ikzePlans: List<IkzePlanEntryDto> = emptyList(),
    val includeIkzeContributionsInCashflow: Boolean = false,
    // Tracker karty kredytowej; null => karta nieskonfigurowana. JSONB blob, brak migracji.
    @field:Valid val creditCard: CreditCardDto? = null,
)

data class CreditCardDto(
    @field:NotBlank val name: String = "Karta kredytowa",
    @field:NotNull val limit: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val availableLimit: BigDecimal = BigDecimal.ZERO,
    @field:Min(1) @field:Max(28) val repaymentDayOfMonth: Int? = null,
)

data class MonthOverrideDto(
    val income: BigDecimal? = null,
    val expenses: BigDecimal? = null,
    val perGoalAllocation: Map<String, BigDecimal>? = null,
)

typealias OverridesDto = Map<String, MonthOverrideDto>

/*
 * typealias does not create a new runtime type. It is a readability alias.
 *
 * JAVA comparison:
 * Java has no direct typealias. You would either repeat Map<String, MonthOverrideDto>
 * everywhere or wrap it in a class.
 *
 * INTERVIEW Q: "Does typealias improve type safety?"
 * A: No. The compiler still treats OverridesDto as Map<String, MonthOverrideDto>.
 *    It improves readability, not type distinction.
 */

data class CsvColumnMappingDto(
    @field:NotBlank val action: String,
    val accountId: UUID? = null,
    val name: String? = null,
    val bucket: AccountBucket? = null,
    val currency: String = "PLN",
)

data class CsvImportMappingDto(
    @field:Min(2000) val year: Int,
    @field:NotEmpty val columns: Map<String, CsvColumnMappingDto>,
)

enum class CategoryKind {
    variable,
    fixed,
    recurring,
}

enum class CashflowTreatment {
    expense,
    income,
    internal_transfer,
    savings,
}

enum class RuleMatchField {
    description,
    counterparty,
}

enum class RuleMatchType {
    contains,
    regex,
}

data class CategoryDto(
    val id: Long? = null,
    @field:NotBlank val name: String,
    @field:NotNull val kind: CategoryKind,
    @field:NotNull val cashflowTreatment: CashflowTreatment = CashflowTreatment.expense,
    val parentId: Long? = null,
)

data class CategoryRuleDto(
    val id: Long? = null,
    @field:NotNull val matchField: RuleMatchField,
    @field:NotNull val matchType: RuleMatchType,
    @field:NotBlank val pattern: String,
    @field:NotNull val categoryId: Long,
    val priority: Int = 100,
    @field:NotBlank val source: String = "manual",
)

data class TransactionDto(
    val id: Long,
    val accountId: UUID,
    @field:NotBlank val bookedAt: String,
    @field:NotNull val amount: BigDecimal,
    @field:NotBlank val currency: String,
    @field:NotBlank val description: String,
    val counterparty: String? = null,
    @field:NotBlank val source: String,
    val categoryId: Long? = null,
    val categoryLocked: Boolean = false,
)

data class TransactionCategoryOverrideDto(
    val categoryId: Long? = null,
    val locked: Boolean = true,
)

data class RecategorizeRequestDto(
    val accountId: UUID? = null,
    val afterTransactionId: Long? = null,
)

data class RecategorizeResultDto(
    val categorized: Int,
    val total: Int,
    @field:Min(0) val changed: Int = 0,
    @field:Min(0) val newlyCategorized: Int = 0,
    @field:Min(0) val deterministicMatched: Int = 0,
    @field:Min(0) val llmAttempted: Int = 0,
    @field:Min(0) val llmCategorized: Int = 0,
    @field:Min(0) val llmNoSuggestion: Int = 0,
    @field:Min(0) val llmLowConfidence: Int = 0,
    @field:Min(0) val llmParseErrors: Int = 0,
    @field:Min(0) val llmTransportErrors: Int = 0,
    @field:Min(0) val llmCategoryMismatch: Int = 0,
    val llmLastTransactionId: Long? = null,
    @field:Min(0) val remainingUncategorized: Int = 0,
    val llmLimitReached: Boolean = false,
)

data class IncomeAnchorDto(
    val id: Long,
    val accountId: UUID,
    @field:NotBlank val accountName: String,
    @field:NotBlank val counterparty: String,
    @field:NotBlank val createdAt: String,
)

data class IncomeAnchorCandidateDto(
    val accountId: UUID,
    @field:NotBlank val accountName: String,
    @field:NotBlank val counterparty: String,
    @field:Min(1) val transactionCount: Int,
    @field:NotBlank val firstBookedAt: String,
    @field:NotBlank val lastBookedAt: String,
    @field:NotNull val totalIncome: BigDecimal,
    val alreadyAnchored: Boolean,
)

data class IncomeAnchorCreateDto(
    @field:NotNull val accountId: UUID,
    @field:NotBlank val counterparty: String,
)

data class PayPeriodSettingsDto(
    @field:Min(1) val minCycleDays: Int = 14,
)

data class PayPeriodDto(
    @field:Min(1) val periodNo: Int,
    val accountId: UUID,
    @field:NotBlank val accountName: String,
    @field:NotBlank val periodStart: String,
    val periodEnd: String? = null,
    val anchorTxId: Long,
    val isPartial: Boolean,
    @field:NotNull val income: BigDecimal,
    @field:NotNull val expense: BigDecimal,
    @field:NotNull val net: BigDecimal,
)

data class PayPeriodRefreshResultDto(
    val periods: Int,
)

data class CycleCategoryRollupDto(
    val categoryId: Long? = null,
    @field:NotBlank val categoryName: String,
    val categoryKind: CategoryKind? = null,
    val cashflowTreatment: CashflowTreatment = CashflowTreatment.expense,
    @field:NotNull val amount: BigDecimal,
    @field:NotNull val income: BigDecimal,
    @field:NotNull val expense: BigDecimal,
    @field:NotNull val savingsContribution: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val savingsWithdrawal: BigDecimal = BigDecimal.ZERO,
    @field:Min(0) val transactionCount: Int,
)

data class RecurringLeakDto(
    @field:NotBlank val counterparty: String,
    val categoryId: Long? = null,
    val categoryName: String? = null,
    val categoryKind: CategoryKind? = null,
    @field:Min(1) val transactionCount: Int,
    @field:NotNull val averageAmount: BigDecimal,
    @field:NotNull val currentCycleAmount: BigDecimal,
    @field:NotBlank val firstBookedAt: String,
    @field:NotBlank val lastBookedAt: String,
)

data class MicroExpenseRollupDto(
    val categoryId: Long? = null,
    @field:NotBlank val categoryName: String,
    val categoryKind: CategoryKind? = null,
    @field:NotNull val expense: BigDecimal,
    @field:Min(1) val transactionCount: Int,
)

data class CycleDeltaDto(
    val categoryId: Long? = null,
    @field:NotBlank val categoryName: String,
    val categoryKind: CategoryKind? = null,
    @field:NotNull val currentExpense: BigDecimal,
    @field:NotNull val baselineAverage: BigDecimal,
    @field:NotNull val increase: BigDecimal,
    val increasePct: BigDecimal? = null,
)

data class CycleLeakAnalysisDto(
    @field:Min(1) val periodNo: Int,
    val accountId: UUID,
    @field:NotBlank val accountName: String,
    @field:NotBlank val periodStart: String,
    val periodEnd: String? = null,
    val isPartial: Boolean,
    @field:NotNull val income: BigDecimal,
    @field:NotNull val expense: BigDecimal,
    @field:NotNull val net: BigDecimal,
    @field:Valid val topCategories: List<CycleCategoryRollupDto>,
    @field:Valid val recurring: List<RecurringLeakDto>,
    @field:Valid val microExpenses: List<MicroExpenseRollupDto>,
    @field:Valid val deltas: List<CycleDeltaDto>,
)

data class FreeCashCycleDto(
    @field:Min(1) val periodNo: Int,
    val accountId: UUID,
    @field:NotBlank val accountName: String,
    @field:NotBlank val periodStart: String,
    val periodEnd: String? = null,
    val isPartial: Boolean,
    @field:NotNull val income: BigDecimal,
    @field:NotNull val fixedExpense: BigDecimal,
    @field:NotNull val recurringExpense: BigDecimal,
    @field:NotNull val committedExpense: BigDecimal,
    @field:NotNull val variableExpense: BigDecimal,
    @field:NotNull val uncategorizedExpense: BigDecimal,
    @field:NotNull val totalExpense: BigDecimal,
    @field:NotNull val savingsContribution: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val savingsWithdrawal: BigDecimal = BigDecimal.ZERO,
    @field:NotNull val net: BigDecimal,
    @field:NotNull val freeCash: BigDecimal,
)

enum class GoalPaceStatus {
    complete,
    no_history,
    unreachable,
    behind_plan,
    on_track,
}

data class GoalPaceDto(
    val goalId: UUID,
    @field:NotBlank val name: String,
    @field:NotNull val targetAmount: BigDecimal,
    @field:NotNull val currentSaved: BigDecimal,
    @field:NotNull val remainingAmount: BigDecimal,
    @field:Min(1) val priority: Int,
    val fixedAllocation: BigDecimal? = null,
    val plannedPerCycle: BigDecimal? = null,
    @field:NotNull val actualPerCycle: BigDecimal,
    val projectedCycles: Int? = null,
    @field:NotNull val status: GoalPaceStatus,
)

data class GoalInsightsDto(
    val currentCycle: FreeCashCycleDto? = null,
    @field:Valid val recentCycles: List<FreeCashCycleDto>,
    @field:Min(0) val cycleCount: Int,
    @field:NotNull val averageNetPerCycle: BigDecimal,
    @field:NotNull val averageFreeCashPerCycle: BigDecimal,
    @field:Valid val goals: List<GoalPaceDto>,
)
