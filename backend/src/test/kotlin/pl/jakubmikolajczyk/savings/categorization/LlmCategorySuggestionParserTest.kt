package pl.jakubmikolajczyk.savings.categorization

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.math.BigDecimal

class LlmCategorySuggestionParserTest {
    private val parser = LlmCategorySuggestionParser(jacksonObjectMapper())

    @Test
    fun `parses ollama json response`() {
        val suggestion = parser.parse("""{"category":"Zakupy spozywcze","confidence":0.93}""")

        assertEquals("Zakupy spozywcze", suggestion?.categoryName)
        assertEquals(0, BigDecimal("0.93").compareTo(suggestion!!.confidence!!))
    }

    @Test
    fun `accepts polish field names returned by a local model`() {
        val suggestion = parser.parse("""{"kategoria":"Jedzenie","pewnosc":"0.82"}""")

        assertEquals("Jedzenie", suggestion?.categoryName)
        assertEquals(0, BigDecimal("0.82").compareTo(suggestion!!.confidence!!))
    }

    @Test
    fun `returns null when category is missing`() {
        assertNull(parser.parse("""{"category":null,"confidence":0.2}"""))
    }
}
