package pl.jakubmikolajczyk.savings.ingest

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate

class VeloPdfAdapterTest {
    private val adapter = VeloPdfAdapter()

    @Test
    fun `parses Velo-like text rows extracted from PDF`() {
        val text = """
            Historia rachunku
            30.12.2022 30.12.2022 Przelew do odbiorcy TESTOWY SKLEP -1 234,56 PLN
            2022-12-22 Wpływ wynagrodzenia ACME SP Z O O 6 000,00 PLN
        """.trimIndent()

        val transactions = adapter.parseText(text)

        assertEquals(2, transactions.size)
        assertEquals(LocalDate.of(2022, 12, 30), transactions[0].bookedAt)
        assertEquals(0, BigDecimal("-1234.56").compareTo(transactions[0].amount))
        assertEquals("PLN", transactions[0].currency)
        assertEquals("Przelew do odbiorcy TESTOWY SKLEP", transactions[0].description)
        assertEquals("30.12.2022 30.12.2022 Przelew do odbiorcy TESTOWY SKLEP -1 234,56 PLN", transactions[0].raw["line"])

        assertEquals(0, BigDecimal("6000.00").compareTo(transactions[1].amount))
    }
}
