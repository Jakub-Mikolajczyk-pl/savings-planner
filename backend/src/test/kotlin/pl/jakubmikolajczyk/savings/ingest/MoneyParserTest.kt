package pl.jakubmikolajczyk.savings.ingest

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal

class MoneyParserTest {
    @Test
    fun `parses US-style amounts`() {
        assertAmount("3600.00", "3,600.00")
        assertAmount("-48576.75", "-48,576.75 PLN")
    }

    @Test
    fun `parses European-style amounts`() {
        assertAmount("3600.00", "3 600,00")
        assertAmount("-453.59", "-453,59 zł")
        assertAmount("-1200.00", "−1 200,00 PLN")
    }

    private fun assertAmount(expected: String, raw: String) {
        assertEquals(0, BigDecimal(expected).compareTo(MoneyParser.parseAmount(raw)))
    }
}
