package pl.jakubmikolajczyk.savings.categorization

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.jakubmikolajczyk.savings.config.IngestProperties
import pl.jakubmikolajczyk.savings.config.LlmProperties
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
import java.text.Normalizer
import java.util.UUID

@Service
class CategorizationService(
    private val repository: CategorizationRepository,
    ingestProperties: IngestProperties = IngestProperties(),
    private val llmCategorySuggester: LlmCategorySuggester = DisabledLlmCategorySuggester,
    private val llmProperties: LlmProperties = LlmProperties(),
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
        /*
         * BATCH WORK, CZYLI "NIE ROBIMY CALEGO SLONIA W JEDNYM REQUESTCIE"
         *
         * Rekategoryzacja ma dwa rodzaje pracy:
         * 1. Tania i szybka: nasze deterministyczne reguly w Kotlinie/Postgresie.
         * 2. Droga i wolna: lokalny LLM, gdzie kazda transakcja to osobne HTTP do Ollamy.
         *
         * Gdybysmy dla 500 transakcji bez kategorii zrobili 500 calli do qwen3:14b
         * w jednym POST /api/recategorize, nginx/proxy prawie na pewno zwroci 504.
         * Backend albo GPU moglyby dalej mielic, ale uzytkownik widzi blad.
         *
         * Dlatego "batch" oznacza tutaj:
         * - w jednym requestcie przejdz po wszystkich transakcjach,
         * - reguly lokalne zastosuj bez limitu, bo sa szybkie,
         * - LLM odpal tylko dla pierwszych N nadal-nieznanych transakcji,
         * - zwroc flage llmLimitReached, zeby UI moglo powiedziec "uruchom ponownie".
         *
         * To nie jest kolejka/asynchroniczny worker. To najprostszy bezpieczny krok:
         * maly kawalek kosztownej pracy na request, powtarzalny tyle razy, ile trzeba.
         */
        val rules = repository.listEngineRules()
        val categories = repository.listCategories()
        val transactions = repository.transactionsForRecategorization(accountId)
        /*
         * coerceAtLeast(0) to ochronny "clamp". Jesli ktos wpisze w ENV -5,
         * traktujemy to jak 0, czyli LLM nie dostanie zadnego batcha.
         *
         * KOTLIN:
         * val = read-only reference. Nie znaczy, ze obiekt zawsze jest immutable,
         * ale tutaj liczba batcha po wyliczeniu nie powinna sie zmieniac.
         */
        val llmBatchSize = llmProperties.recategorizeBatchSize.coerceAtLeast(0)
        /*
         * var = zmienna, ktora bedziemy aktualizowac w petli.
         * W batch work czesto trzymasz male liczniki postepu:
         * - ile elementow faktycznie skategoryzowano,
         * - ile razy uderzylismy w LLM,
         * - czy zatrzymalismy sie na limicie batcha.
         */
        var categorized = 0
        var llmAttempted = 0
        var llmLimitReached = false

        transactions.forEach { tx ->
            /*
             * Najpierw probujemy czesci deterministycznej.
             *
             * Operator ?: to "Elvis operator":
             *   a ?: b
             * znaczy: jesli a nie jest nullem, uzyj a; jesli a jest nullem, uzyj b.
             *
             * Tutaj:
             * - internalTransferCategoryId(...) zwraca Long? (id kategorii albo null),
             * - jesli nie znajdzie transferu wlasnego, probujemy ruleEngine,
             * - jesli reguly tez nie trafia, deterministicCategoryId zostaje null.
             */
            val deterministicCategoryId = internalTransferCategoryId(tx.description, tx.amount)
                ?: ruleEngine.firstMatch(
                    RuleInput(description = tx.description, counterparty = tx.counterparty),
                    rules,
                )?.categoryId
            /*
             * when w Kotlinie to mocniejszy switch. Tu dziala jak czytelny if/else-if/else.
             *
             * Kolejnosc ma znaczenie:
             * 1. Jesli deterministycznie znalezlismy kategorie, bierzemy ja.
             * 2. Jesli transakcja juz miala kategorie, zostawiamy ja i nie marnujemy LLM.
             * 3. Jesli mamy jeszcze miejsce w batchu, pytamy LLM.
             * 4. Jesli limit batcha sie skonczyl, ustawiamy flage i zostawiamy null.
             */
            val categoryId = deterministicCategoryId ?: when {
                tx.categoryId != null -> tx.categoryId
                llmAttempted < llmBatchSize -> {
                    /*
                     * Inkrementujemy PRZED wywolaniem LLM, bo nawet jesli Ollama nie trafi
                     * albo chwilowo zwroci blad, ten request juz zuzyl slot kosztownej pracy.
                     */
                    llmAttempted++
                    llmCategoryId(
                        input = LlmCategorizationInput(
                            description = tx.description,
                            counterparty = tx.counterparty,
                            amount = tx.amount,
                            currency = tx.currency,
                        ),
                        categories = categories,
                    )
                }
                else -> {
                    /*
                     * Nie przerywamy calej petli, bo pozniejsze transakcje moglyby jeszcze
                     * dostac kategorie z reguly deterministycznej. Flaga tylko informuje UI,
                     * ze LLM mial wiecej pracy niz limit obecnego requestu.
                     */
                    llmLimitReached = true
                    null
                }
            }

            repository.setTransactionCategoryIfUnlocked(tx.id, categoryId)
            if (categoryId != null) categorized++
        }

        return RecategorizeResultDto(
            categorized = categorized,
            total = transactions.size,
            llmAttempted = llmAttempted,
            llmLimitReached = llmLimitReached,
        )
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
        currency: String = "PLN",
    ) {
        val categories = repository.listCategories()
        val categoryId = internalTransferCategoryId(description, amount)
            ?: ruleEngine.firstMatch(
                RuleInput(description = description, counterparty = counterparty),
                repository.listEngineRules(),
            )?.categoryId
            ?: llmCategoryId(
                input = LlmCategorizationInput(
                    description = description,
                    counterparty = counterparty,
                    amount = amount,
                    currency = currency,
                ),
                categories = categories,
            )
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

    private fun llmCategoryId(input: LlmCategorizationInput, categories: List<CategoryDto>): Long? {
        val normalizedCategories = categories.associateBy { normalizeLlmCategoryName(it.name) }
        val suggestion = llmCategorySuggester.suggest(input, categories) ?: return null
        return normalizedCategories[normalizeLlmCategoryName(suggestion.categoryName)]?.id
    }

    private fun normalizeLlmCategoryName(value: String): String =
        Normalizer.normalize(ruleEngine.normalize(value), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
}
