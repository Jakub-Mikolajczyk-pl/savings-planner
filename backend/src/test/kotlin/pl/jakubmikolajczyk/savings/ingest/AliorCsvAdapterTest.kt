package pl.jakubmikolajczyk.savings.ingest

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate

class AliorCsvAdapterTest {
    private val adapter = AliorCsvAdapter()

    @Test
    fun `parses real Alior export shape with criteria line before header`() {
        val input = javaClass.getResourceAsStream("/fixtures/alior_sample.csv")
            ?: error("Missing Alior fixture")

        val transactions = adapter.parse(input)

        assertEquals(3, transactions.size)
        assertEquals(LocalDate.of(2022, 12, 30), transactions[0].bookedAt)
        assertEquals(0, BigDecimal("-17.60").compareTo(transactions[0].amount))
        assertEquals("PLN", transactions[0].currency)
        assertEquals("Oplata za autostrade", transactions[0].description)
        assertEquals("BLUE MEDIA SA", transactions[0].counterparty)
        assertEquals("64 2490 0005 0000 4000 0000 0000", transactions[0].raw["Numer rachunku nadawcy"])

        assertEquals("ADA TESTOWA", transactions[2].counterparty)
        assertEquals(0, BigDecimal("500.00").compareTo(transactions[2].amount))
    }

    @Test
    fun `handles quoted semicolons`() {
        val parsed = adapter.parseCsvLine("\"a;b\";c;\"d\"\"e\"")

        assertEquals(listOf("a;b", "c", "d\"e"), parsed)
    }
}
