package pl.jakubmikolajczyk.savings.leakanalysis

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate

class LeakAnalysisEngineTest {
    private val engine = LeakAnalysisEngine()

    @Test
    fun `recurring detection requires similar amount monthly rhythm and selected-cycle hit`() {
        val rows = listOf(
            tx(1, "2026-01-05", "-39.99", "Spotify", 1),
            tx(2, "2026-02-05", "-40.99", " SPOTIFY ", 2),
            tx(3, "2026-03-06", "-39.99", "spotify", 3),
            tx(4, "2026-03-07", "-120.00", "One-off shop", 3),
        )

        val recurring = engine.detectRecurring(rows, selectedPeriodNo = 3)

        assertEquals(1, recurring.size)
        assertEquals("spotify", recurring.single().counterparty)
        assertEquals(BigDecimal("39.99"), recurring.single().currentCycleAmount)
        assertEquals(3, recurring.single().transactionCount)
    }

    @Test
    fun `delta baseline skips partial periods and treats missing category as zero`() {
        val points = listOf(
            point(periodNo = 1, partial = true, name = "Zakupy", expense = "999.00"),
            point(periodNo = 2, partial = false, name = "Zakupy", expense = "100.00"),
            point(periodNo = 3, partial = false, name = "Zakupy", expense = "150.00"),
            point(periodNo = 4, partial = false, name = "Transport", expense = "60.00"),
            point(periodNo = 5, partial = false, name = "Zakupy", expense = "300.00"),
        )

        val deltas = engine.deltaHighlights(points, selectedPeriodNo = 5)

        assertEquals(1, deltas.size)
        assertEquals("Zakupy", deltas.single().categoryName)
        assertEquals(BigDecimal("83.33"), deltas.single().baselineAverage)
        assertEquals(BigDecimal("216.67"), deltas.single().increase)
    }

    private fun tx(id: Long, bookedAt: String, amount: String, counterparty: String, periodNo: Int) =
        LeakTransactionSample(
            id = id,
            bookedAt = LocalDate.parse(bookedAt),
            amount = BigDecimal(amount),
            counterparty = counterparty,
            periodNo = periodNo,
            categoryId = null,
            categoryName = null,
            categoryKind = null,
        )

    private fun point(periodNo: Int, partial: Boolean, name: String, expense: String) =
        CategoryExpensePoint(
            periodNo = periodNo,
            isPartial = partial,
            categoryId = null,
            categoryName = name,
            categoryKind = null,
            expense = BigDecimal(expense),
        )
}

