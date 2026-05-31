package pl.jakubmikolajczyk.savings.categorization

import pl.jakubmikolajczyk.savings.dto.RuleMatchField
import pl.jakubmikolajczyk.savings.dto.RuleMatchType
import java.util.Locale
import java.util.regex.PatternSyntaxException

data class CategoryRule(
    val id: Long,
    val matchField: RuleMatchField,
    val matchType: RuleMatchType,
    val pattern: String,
    val categoryId: Long,
    val priority: Int,
    val source: String,
)

data class RuleInput(
    val description: String,
    val counterparty: String?,
)

class RuleEngine {
    fun firstMatch(input: RuleInput, rules: List<CategoryRule>): CategoryRule? =
        rules
            .sortedWith(compareBy<CategoryRule> { it.priority }.thenBy { it.id })
            .firstOrNull { rule -> matches(input, rule) }

    fun normalize(value: String): String =
        value.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)

    private fun matches(input: RuleInput, rule: CategoryRule): Boolean {
        val rawValue = when (rule.matchField) {
            RuleMatchField.description -> input.description
            RuleMatchField.counterparty -> input.counterparty
        } ?: return false

        val value = normalize(rawValue)
        val pattern = normalize(rule.pattern)

        return when (rule.matchType) {
            RuleMatchType.contains -> value.contains(pattern)
            RuleMatchType.regex -> runCatching { Regex(rule.pattern, RegexOption.IGNORE_CASE).containsMatchIn(rawValue) }
                .getOrElse { error ->
                    if (error is PatternSyntaxException || error.cause is PatternSyntaxException) false else false
                }
        }
    }
}
