package pl.jakubmikolajczyk.savings.payperiod

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.util.UUID

class PayPeriodEngineTest {
    private val engine = PayPeriodEngine()
    private val accountId = UUID.fromString("00000000-0000-0000-0000-000000000001")

    @Test
    fun `guard compares candidate with last accepted anchor`() {
        val periods = engine.calculate(
            listOf(
                anchor(1, "2026-01-01"),
                anchor(2, "2026-01-10"),
                anchor(3, "2026-01-20"),
            ),
            minCycleDays = 14,
        )

        assertEquals(2, periods.size)
        assertEquals(LocalDate.parse("2026-01-01"), periods[0].periodStart)
        assertEquals(LocalDate.parse("2026-01-20"), periods[1].periodStart)
        assertEquals(LocalDate.parse("2026-01-20"), periods[0].periodEnd)
    }

    @Test
    fun `first and last periods are partial`() {
        val periods = engine.calculate(
            listOf(
                anchor(1, "2026-02-01"),
                anchor(2, "2026-03-01"),
                anchor(3, "2026-04-01"),
            ),
            minCycleDays = 14,
        )

        assertTrue(periods.first().isPartial)
        assertEquals(false, periods[1].isPartial)
        assertTrue(periods.last().isPartial)
        assertEquals(null, periods.last().periodEnd)
    }

    private fun anchor(id: Long, date: String) = IncomeAnchorTransaction(
        transactionId = id,
        accountId = accountId,
        bookedAt = LocalDate.parse(date),
    )
}
