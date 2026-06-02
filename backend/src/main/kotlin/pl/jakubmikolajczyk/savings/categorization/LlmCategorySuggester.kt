package pl.jakubmikolajczyk.savings.categorization

import pl.jakubmikolajczyk.savings.dto.CategoryDto
import java.math.BigDecimal

data class LlmCategorizationInput(
    val description: String,
    val counterparty: String?,
    val amount: BigDecimal,
    val currency: String,
)

data class LlmCategorySuggestion(
    val categoryId: Long?,
    val categoryName: String?,
    val confidence: BigDecimal?,
)

enum class LlmCategoryOutcome {
    disabled,
    categorized,
    no_category,
    low_confidence,
    parse_error,
    transport_error,
}

data class LlmCategoryDecision(
    val outcome: LlmCategoryOutcome,
    val suggestion: LlmCategorySuggestion? = null,
)

interface LlmCategorySuggester {
    fun suggest(input: LlmCategorizationInput, categories: List<CategoryDto>): LlmCategoryDecision
}

object DisabledLlmCategorySuggester : LlmCategorySuggester {
    override fun suggest(input: LlmCategorizationInput, categories: List<CategoryDto>): LlmCategoryDecision =
        LlmCategoryDecision(LlmCategoryOutcome.disabled)
}
