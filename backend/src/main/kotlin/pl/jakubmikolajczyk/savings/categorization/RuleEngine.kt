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
        /*
         * `when` is Kotlin's nicer switch, but it is also an expression.
         *
         * JAVA comparison:
         * Java's modern switch expression is now close, but Kotlin had this style
         * early. Because RuleMatchField is an enum, the compiler can warn us if a
         * new enum value appears and this branch stops being exhaustive.
         */
        val rawValue = when (rule.matchField) {
            RuleMatchField.description -> input.description
            RuleMatchField.counterparty -> input.counterparty
        } ?: return false

        val value = normalize(rawValue)
        val pattern = normalize(rule.pattern)

        return when (rule.matchType) {
            RuleMatchType.contains -> value.contains(pattern)
            /*
             * runCatching wraps exceptions into Result instead of throwing through
             * the call stack. Nice for "try this risky parser/matcher and degrade".
             *
             * INTERVIEW Q: "Should every exception be swallowed with runCatching?"
             * A: No. Use it at deliberate boundaries. Here a bad regex rule should
             *    not break categorization of all transactions.
             */
            RuleMatchType.regex -> runCatching { Regex(rule.pattern, RegexOption.IGNORE_CASE).containsMatchIn(rawValue) }
                .getOrElse { error ->
                    if (error is PatternSyntaxException || error.cause is PatternSyntaxException) false else false
                }
        }
    }
}
