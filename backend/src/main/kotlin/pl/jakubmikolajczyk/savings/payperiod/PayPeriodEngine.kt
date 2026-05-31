package pl.jakubmikolajczyk.savings.payperiod

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

data class IncomeAnchorTransaction(
    val transactionId: Long,
    val accountId: UUID,
    val bookedAt: LocalDate,
)

data class CalculatedPayPeriod(
    val periodNo: Int,
    val accountId: UUID,
    val periodStart: LocalDate,
    val periodEnd: LocalDate?,
    val anchorTxId: Long,
    val isPartial: Boolean,
)

class PayPeriodEngine {
    fun calculate(anchors: List<IncomeAnchorTransaction>, minCycleDays: Int): List<CalculatedPayPeriod> {
        val acceptedAnchors = anchors
            .groupBy { it.accountId }
            .flatMap { (_, accountAnchors) -> acceptAnchorsForAccount(accountAnchors, minCycleDays) }
            .sortedWith(compareBy<IncomeAnchorTransaction> { it.accountId.toString() }.thenBy { it.bookedAt }.thenBy { it.transactionId })

        return acceptedAnchors
            .groupBy { it.accountId }
            .flatMap { (_, accountAnchors) ->
                accountAnchors.mapIndexed { index, anchor ->
                    /*
                     * INTERVIEW Q: why look at index + 1 instead of SQL lead() here?
                     * A: after the guard removes too-close anchors, the "next" boundary is
                     *    simply the next accepted item. Keeping that in Kotlin makes the
                     *    recursive guard easy to unit-test.
                     */
                    CalculatedPayPeriod(
                        periodNo = index + 1,
                        accountId = anchor.accountId,
                        periodStart = anchor.bookedAt,
                        periodEnd = accountAnchors.getOrNull(index + 1)?.bookedAt,
                        anchorTxId = anchor.transactionId,
                        isPartial = index == 0 || index == accountAnchors.lastIndex,
                    )
                }
            }
    }

    private fun acceptAnchorsForAccount(
        anchors: List<IncomeAnchorTransaction>,
        minCycleDays: Int,
    ): List<IncomeAnchorTransaction> {
        val sorted = anchors.sortedWith(compareBy<IncomeAnchorTransaction> { it.bookedAt }.thenBy { it.transactionId })
        val accepted = mutableListOf<IncomeAnchorTransaction>()

        for (anchor in sorted) {
            val previousAccepted = accepted.lastOrNull()
            val daysSincePrevious = previousAccepted?.let { ChronoUnit.DAYS.between(it.bookedAt, anchor.bookedAt) }

            if (daysSincePrevious == null || daysSincePrevious >= minCycleDays) {
                accepted += anchor
            }
        }

        return accepted
    }
}
