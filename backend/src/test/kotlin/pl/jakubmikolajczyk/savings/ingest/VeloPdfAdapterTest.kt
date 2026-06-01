package pl.jakubmikolajczyk.savings.ingest

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import pl.jakubmikolajczyk.savings.config.IngestProperties
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

    @Test
    fun `parses Velo table cells split into separate PDF lines`() {
        val text = """
            Wyciag z rachunku
            Saldo poczatkowe 4 516,39
            2025.09.01
            2025.09.01
            Przelew wychodzacy
            TESTOWY ODBIORCA
            Tytul: rata 09-2025
            -1 184,34
            3 332,05
            2025.09.08
            2025.09.06
            Platnosc karta
            66,56 PLN z dnia 2025.09.06
            TESTOWY SKLEP
            -66,56
            2 899,12
            2025.09.30
            2025.09.30
            Przelew przychodzacy
            TESTOWY NADAWCA
            6 000,00
            10 120,97
            Obroty WN
            Obroty MA
            Saldo koncowe
            -11 555,42
            17 160,00
            10 120,97
        """.trimIndent()

        val transactions = adapter.parseText(text)

        assertEquals(3, transactions.size)
        assertEquals(LocalDate.of(2025, 9, 1), transactions[0].bookedAt)
        assertEquals(0, BigDecimal("-1184.34").compareTo(transactions[0].amount))
        assertEquals("Przelew wychodzacy TESTOWY ODBIORCA Tytul: rata 09-2025", transactions[0].description)

        assertEquals(LocalDate.of(2025, 9, 8), transactions[1].bookedAt)
        assertEquals(0, BigDecimal("-66.56").compareTo(transactions[1].amount))
        assertEquals("Platnosc karta 66,56 PLN z dnia 2025.09.06 TESTOWY SKLEP", transactions[1].description)

        assertEquals(LocalDate.of(2025, 9, 30), transactions[2].bookedAt)
        assertEquals(0, BigDecimal("6000.00").compareTo(transactions[2].amount))
        assertEquals("Przelew przychodzacy TESTOWY NADAWCA", transactions[2].description)
    }

    @Test
    fun `marks configured incoming own-account transfers for categorization`() {
        val ownSourceAccount = "PL00111122223333444455556666"
        val adapter = VeloPdfAdapter(
            IngestProperties(internalTransferSourceAccounts = listOf(ownSourceAccount)),
        )
        val text = """
            2025.09.30
            2025.09.30
            Przelew przychodzacy
            Rachunek nadawcy: $ownSourceAccount
            TESTOWY NADAWCA
            6 000,00
            10 120,97
        """.trimIndent()

        val transaction = adapter.parseText(text).single()

        assertEquals(0, BigDecimal("6000.00").compareTo(transaction.amount))
        assertEquals(true, transaction.description.startsWith("Przelew wlasny "))
    }
}
