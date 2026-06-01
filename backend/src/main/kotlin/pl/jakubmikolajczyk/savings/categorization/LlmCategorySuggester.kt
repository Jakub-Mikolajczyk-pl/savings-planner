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
    val categoryName: String,
    val confidence: BigDecimal?,
)

interface LlmCategorySuggester {
    fun suggest(input: LlmCategorizationInput, categories: List<CategoryDto>): LlmCategorySuggestion?
}

object DisabledLlmCategorySuggester : LlmCategorySuggester {
    override fun suggest(input: LlmCategorizationInput, categories: List<CategoryDto>): LlmCategorySuggestion? = null
}
