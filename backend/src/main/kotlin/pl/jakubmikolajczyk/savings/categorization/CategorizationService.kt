package pl.jakubmikolajczyk.savings.categorization

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.jakubmikolajczyk.savings.config.IngestProperties
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import pl.jakubmikolajczyk.savings.dto.CategoryDto
import pl.jakubmikolajczyk.savings.dto.CategoryRuleDto
import pl.jakubmikolajczyk.savings.dto.RecategorizeResultDto
import pl.jakubmikolajczyk.savings.dto.RuleMatchType
import pl.jakubmikolajczyk.savings.dto.TransactionCategoryOverrideDto
import pl.jakubmikolajczyk.savings.dto.TransactionDto
import pl.jakubmikolajczyk.savings.ingest.InternalTransferDetector
import java.math.BigDecimal
import java.util.UUID

@Service
class CategorizationService(
    private val repository: CategorizationRepository,
    ingestProperties: IngestProperties = IngestProperties(),
) {
    private val ruleEngine = RuleEngine()
    private val internalTransfers = InternalTransferDetector(ingestProperties)
    private val allowedSources = setOf("manual", "seed", "llm")

    fun listCategories(): List<CategoryDto> = repository.listCategories()

    fun createCategory(dto: CategoryDto): CategoryDto = repository.createCategory(dto)

    fun updateCategory(id: Long, dto: CategoryDto): CategoryDto =
        repository.updateCategory(id, dto) ?: throw NotFoundException("Category $id not found")

    fun deleteCategory(id: Long) {
        if (repository.deleteCategory(id) == 0) throw NotFoundException("Category $id not found")
    }

    fun listRules(): List<CategoryRuleDto> = repository.listRules()

    fun createRule(dto: CategoryRuleDto): CategoryRuleDto {
        validateRule(dto)
        /*
         * LLM fallback materializes verdicts as normal rules. Returning the existing
         * duplicate makes that batch path idempotent without relying only on the DB
         * unique index.
         */
        repository.findDuplicateRule(dto)?.let { return it }
        return repository.createRule(dto)
    }

    fun updateRule(id: Long, dto: CategoryRuleDto): CategoryRuleDto {
        validateRule(dto)
        return repository.updateRule(id, dto) ?: throw NotFoundException("Category rule $id not found")
    }

    fun deleteRule(id: Long) {
        if (repository.deleteRule(id) == 0) throw NotFoundException("Category rule $id not found")
    }

    fun listTransactions(accountId: UUID?, onlyUncategorized: Boolean, limit: Int): List<TransactionDto> =
        repository.listTransactions(accountId, onlyUncategorized, limit)

    @Transactional
    fun recategorize(accountId: UUID?): RecategorizeResultDto {
        val rules = repository.listEngineRules()
        val transactions = repository.transactionsForRecategorization(accountId)
        var categorized = 0

        transactions.forEach { tx ->
            val categoryId = internalTransferCategoryId(tx.description, tx.amount)
                ?: ruleEngine.firstMatch(
                    RuleInput(description = tx.description, counterparty = tx.counterparty),
                    rules,
                )?.categoryId

            repository.setTransactionCategoryIfUnlocked(tx.id, categoryId)
            if (categoryId != null) categorized++
        }

        return RecategorizeResultDto(categorized = categorized, total = transactions.size)
    }

    @Transactional
    fun overrideTransactionCategory(transactionId: Long, dto: TransactionCategoryOverrideDto) {
        if (dto.categoryId != null) requireCategory(dto.categoryId)
        if (repository.overrideTransactionCategory(transactionId, dto.categoryId, dto.locked) == 0) {
            throw NotFoundException("Transaction $transactionId not found")
        }
    }

    fun categorizeInsertedTransaction(
        transactionId: Long,
        description: String,
        counterparty: String?,
        amount: BigDecimal,
    ) {
        val categoryId = internalTransferCategoryId(description, amount)
            ?: ruleEngine.firstMatch(
                RuleInput(description = description, counterparty = counterparty),
                repository.listEngineRules(),
            )?.categoryId
            ?: return

        repository.setInsertedTransactionCategory(transactionId, categoryId)
    }

    private fun validateRule(dto: CategoryRuleDto) {
        requireCategory(dto.categoryId)
        if (dto.source !in allowedSources) throw BadRequestException("Rule source must be one of $allowedSources")
        if (dto.matchType == RuleMatchType.regex) {
            try {
                Regex(dto.pattern)
            } catch (ex: IllegalArgumentException) {
                throw BadRequestException("Invalid rule regex: ${ex.message}")
            }
        }
    }

    private fun requireCategory(id: Long) =
        repository.findCategory(id) ?: throw NotFoundException("Category $id not found")

    private fun internalTransferCategoryId(description: String, amount: BigDecimal): Long? =
        if (internalTransfers.isIncomingFromOwnSourceAccount(amount, description)) {
            repository.findCategoryByName("Transfery")?.id
        } else {
            null
        }
}
