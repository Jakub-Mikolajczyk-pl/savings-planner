package pl.jakubmikolajczyk.savings.leakanalysis

import pl.jakubmikolajczyk.savings.dto.CategoryKind
import pl.jakubmikolajczyk.savings.dto.CycleDeltaDto
import pl.jakubmikolajczyk.savings.dto.RecurringLeakDto
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.max

data class LeakTransactionSample(
    val id: Long,
    val bookedAt: LocalDate,
    val amount: BigDecimal,
    val counterparty: String,
    val periodNo: Int,
    val categoryId: Long?,
    val categoryName: String?,
    val categoryKind: CategoryKind?,
)

data class CategoryExpensePoint(
    val periodNo: Int,
    val isPartial: Boolean,
    val categoryId: Long?,
    val categoryName: String,
    val categoryKind: CategoryKind?,
    val expense: BigDecimal,
)

/*
 * This class is deliberately framework-free: no Spring annotation, no database,
 * no clock. That is a common Kotlin/Spring move worth remembering.
 *
 * INTERVIEW Q: "Why not put this logic directly in the service?"
 * A: A pure class is easier to unit-test. The service can handle orchestration
 *    and transactions; the engine can handle business rules with plain objects.
 */
class LeakAnalysisEngine {
    fun detectRecurring(
        transactions: List<LeakTransactionSample>,
        selectedPeriodNo: Int,
    ): List<RecurringLeakDto> =
        transactions
            .filter { it.amount < BigDecimal.ZERO }
            .groupBy { normalizeCounterparty(it.counterparty) }
            .flatMap { (counterparty, rows) -> recurringClusters(counterparty, rows, selectedPeriodNo) }
            .sortedWith(compareByDescending<RecurringLeakDto> { it.currentCycleAmount }.thenBy { it.counterparty })

    fun deltaHighlights(
        points: List<CategoryExpensePoint>,
        selectedPeriodNo: Int,
        baselineSize: Int = 3,
    ): List<CycleDeltaDto> {
        val baselinePeriodNos = points
            .asSequence()
            .filter { it.periodNo < selectedPeriodNo && !it.isPartial }
            .map { it.periodNo }
            .distinct()
            .sortedDescending()
            .take(baselineSize)
            .toList()

        if (baselinePeriodNos.isEmpty()) return emptyList()

        val currentByCategory = points
            .filter { it.periodNo == selectedPeriodNo }
            .associateBy({ CategoryKey.from(it) }, { it })

        val baselineByCategoryAndPeriod = points
            .filter { it.periodNo in baselinePeriodNos }
            .associateBy({ CategoryPeriodKey(CategoryKey.from(it), it.periodNo) }, { it.expense })

        /*
         * Kotlin quirk: mapNotNull both transforms and filters nulls.
         * Java streams would usually spell this as map(...).filter(Objects::nonNull).
         */
        return currentByCategory.mapNotNull { (key, current) ->
            val baselineTotal = baselinePeriodNos.fold(BigDecimal.ZERO) { total, periodNo ->
                total + (baselineByCategoryAndPeriod[CategoryPeriodKey(key, periodNo)] ?: BigDecimal.ZERO)
            }
            val baselineAverage = baselineTotal.divide(BigDecimal(baselinePeriodNos.size), 2, RoundingMode.HALF_UP)
            val increase = current.expense - baselineAverage

            if (increase <= BigDecimal.ZERO) return@mapNotNull null

            CycleDeltaDto(
                categoryId = current.categoryId,
                categoryName = current.categoryName,
                categoryKind = current.categoryKind,
                currentExpense = current.expense,
                baselineAverage = baselineAverage,
                increase = increase,
                increasePct = if (baselineAverage > BigDecimal.ZERO) {
                    increase
                        .multiply(BigDecimal("100"))
                        .divide(baselineAverage, 1, RoundingMode.HALF_UP)
                } else {
                    null
                },
            )
        }.sortedWith(compareByDescending<CycleDeltaDto> { it.increase }.thenBy { it.categoryName })
    }

    private fun recurringClusters(
        counterparty: String,
        rows: List<LeakTransactionSample>,
        selectedPeriodNo: Int,
    ): List<RecurringLeakDto> {
        val clusters = mutableListOf<MutableList<LeakTransactionSample>>()

        rows.sortedWith(compareBy<LeakTransactionSample> { it.bookedAt }.thenBy { it.id }).forEach { row ->
            val amount = row.amount.abs()
            val target = clusters.firstOrNull { cluster -> isSimilarAmount(amount, averageAbsAmount(cluster)) }
            if (target == null) {
                clusters += mutableListOf(row)
            } else {
                target += row
            }
        }

        return clusters.mapNotNull { cluster ->
            val selectedRows = cluster.filter { it.periodNo == selectedPeriodNo }
            if (cluster.size < 3 || selectedRows.isEmpty() || !hasMonthlyRhythm(cluster)) return@mapNotNull null

            val sorted = cluster.sortedBy { it.bookedAt }
            val representative = selectedRows.firstOrNull() ?: sorted.last()
            RecurringLeakDto(
                counterparty = counterparty,
                categoryId = representative.categoryId,
                categoryName = representative.categoryName,
                categoryKind = representative.categoryKind,
                transactionCount = cluster.size,
                averageAmount = averageAbsAmount(cluster).setScale(2, RoundingMode.HALF_UP),
                currentCycleAmount = selectedRows.fold(BigDecimal.ZERO) { sum, tx -> sum + tx.amount.abs() },
                firstBookedAt = sorted.first().bookedAt.toString(),
                lastBookedAt = sorted.last().bookedAt.toString(),
            )
        }
    }

    private fun hasMonthlyRhythm(rows: List<LeakTransactionSample>): Boolean {
        val gaps = rows
            .sortedBy { it.bookedAt }
            .zipWithNext { left, right -> ChronoUnit.DAYS.between(left.bookedAt, right.bookedAt) }

        if (gaps.isEmpty()) return false

        val monthlyGaps = gaps.count { it in 20..45 }
        return monthlyGaps >= max(1, (gaps.size * 0.7).toInt())
    }

    private fun isSimilarAmount(left: BigDecimal, right: BigDecimal): Boolean {
        val toleranceByPercent = right.multiply(BigDecimal("0.08"))
        val tolerance = toleranceByPercent.max(BigDecimal("5.00"))
        return left.subtract(right).abs() <= tolerance
    }

    private fun averageAbsAmount(rows: List<LeakTransactionSample>): BigDecimal =
        rows
            .fold(BigDecimal.ZERO) { sum, row -> sum + row.amount.abs() }
            .divide(BigDecimal(rows.size), 4, RoundingMode.HALF_UP)
}

fun normalizeCounterparty(value: String): String =
    value.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)

private data class CategoryKey(
    val categoryId: Long?,
    val categoryName: String,
) {
    companion object {
        fun from(point: CategoryExpensePoint) = CategoryKey(point.categoryId, point.categoryName)
    }
}

private data class CategoryPeriodKey(
    val category: CategoryKey,
    val periodNo: Int,
)

