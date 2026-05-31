package pl.jakubmikolajczyk.savings.categorization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import pl.jakubmikolajczyk.savings.dto.RuleMatchField
import pl.jakubmikolajczyk.savings.dto.RuleMatchType

class RuleEngineTest {
    private val engine = RuleEngine()

    @Test
    fun `contains rules use normalized lowercase text`() {
        val rules = listOf(
            rule(id = 1, pattern = "biedronka", categoryId = 10),
        )

        val match = engine.firstMatch(
            RuleInput(description = "  Platnosc karta   BIEDRONKA 123  ", counterparty = null),
            rules,
        )

        assertEquals(10, match?.categoryId)
    }

    @Test
    fun `first matching priority wins`() {
        val rules = listOf(
            rule(id = 2, pattern = "netia", categoryId = 2, priority = 20),
            rule(id = 1, pattern = "net", categoryId = 1, priority = 10),
        )

        val match = engine.firstMatch(
            RuleInput(description = "NETIA rachunek", counterparty = "NETIA SA"),
            rules,
        )

        assertEquals(1, match?.categoryId)
    }

    @Test
    fun `regex rules match selected field and invalid regex is skipped`() {
        val rules = listOf(
            rule(id = 1, matchType = RuleMatchType.regex, pattern = "(", categoryId = 1),
            rule(id = 2, matchType = RuleMatchType.regex, pattern = "LIDL\\s+\\d+", categoryId = 2),
        )

        val match = engine.firstMatch(
            RuleInput(description = "Zakup LIDL 123", counterparty = null),
            rules,
        )

        assertEquals(2, match?.categoryId)
    }

    @Test
    fun `counterparty rule does not match missing counterparty`() {
        val rules = listOf(
            rule(id = 1, matchField = RuleMatchField.counterparty, pattern = "zabka", categoryId = 1),
        )

        assertNull(engine.firstMatch(RuleInput(description = "ZABKA", counterparty = null), rules))
    }

    private fun rule(
        id: Long,
        matchField: RuleMatchField = RuleMatchField.description,
        matchType: RuleMatchType = RuleMatchType.contains,
        pattern: String,
        categoryId: Long,
        priority: Int = 100,
    ) = CategoryRule(
        id = id,
        matchField = matchField,
        matchType = matchType,
        pattern = pattern,
        categoryId = categoryId,
        priority = priority,
        source = "manual",
    )
}
