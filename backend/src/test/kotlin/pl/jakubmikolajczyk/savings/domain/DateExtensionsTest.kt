package pl.jakubmikolajczyk.savings.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.LocalDate

class DateExtensionsTest {
    @Test
    fun `converts api month to first day in database`() {
        assertEquals(LocalDate.of(2026, 5, 1), "2026-05".toMonthStart())
    }

    @Test
    fun `converts database date to api month`() {
        assertEquals("2026-05", LocalDate.of(2026, 5, 1).toYearMonth())
    }
}

