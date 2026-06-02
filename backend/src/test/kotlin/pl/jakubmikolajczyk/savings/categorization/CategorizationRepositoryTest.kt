package pl.jakubmikolajczyk.savings.categorization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import pl.jakubmikolajczyk.savings.config.IngestProperties
import pl.jakubmikolajczyk.savings.dto.TransactionCategoryOverrideDto
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.math.BigDecimal
import java.sql.Date
import java.time.LocalDate

@DataJpaTest
@Testcontainers(disabledWithoutDocker = true)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class CategorizationRepositoryTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val jdbc: NamedParameterJdbcTemplate,
) {
    private val repository = CategorizationRepository(jdbc)
    private val service = CategorizationService(repository)
    private val ownTransferService = CategorizationService(
        repository,
        IngestProperties(internalTransferSourceAccounts = listOf("PL00111122223333444455556666")),
    )
    private val llmFallbackService = CategorizationService(
        repository,
        llmCategorySuggester = object : LlmCategorySuggester {
            override fun suggest(input: LlmCategorizationInput, categories: List<pl.jakubmikolajczyk.savings.dto.CategoryDto>) =
                LlmCategoryDecision(
                    outcome = LlmCategoryOutcome.categorized,
                    suggestion = LlmCategorySuggestion(
                        categoryId = categories.first { it.name == "Zakupy spozywcze" }.id,
                        categoryName = "Zakupy spozywcze",
                        confidence = BigDecimal("0.91"),
                    ),
                )
        },
    )

    @Test
    fun `V4 seeds rules and recategorization is idempotent`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        val transactionId = insertTransaction(
            accountId = account.id,
            description = "Platnosc karta BIEDRONKA 123",
            counterparty = "BIEDRONKA",
        )

        assertNotNull(repository.listCategories().find { it.name == "Zakupy spozywcze" })
        assertNotNull(repository.listRules().find { it.pattern == "biedronka" })

        val first = service.recategorize(account.id)
        val second = service.recategorize(account.id)

        assertEquals(1, first.total)
        assertEquals(1, first.categorized)
        assertEquals(1, first.changed)
        assertEquals(1, first.newlyCategorized)
        assertEquals(1, second.total)
        assertEquals(1, second.categorized)
        assertEquals(0, second.changed)
        assertEquals(0, second.newlyCategorized)
        assertEquals(
            repository.listCategories().first { it.name == "Zakupy spozywcze" }.id,
            repository.listTransactions(account.id, onlyUncategorized = false, limit = 10).first { it.id == transactionId }.categoryId,
        )
    }

    @Test
    fun `manual override is not overwritten by recategorization`() {
        val account = accounts.save(AccountEntity(name = "Velo", bucket = "accounts"))
        val transactionId = insertTransaction(
            accountId = account.id,
            description = "Platnosc karta LIDL",
            counterparty = "LIDL",
        )
        val otherCategoryId = repository.listCategories().first { it.name == "Inne" }.id!!

        service.overrideTransactionCategory(
            transactionId,
            TransactionCategoryOverrideDto(categoryId = otherCategoryId, locked = true),
        )
        service.recategorize(account.id)

        val transaction = repository.listTransactions(account.id, onlyUncategorized = false, limit = 10).first()
        assertEquals(otherCategoryId, transaction.categoryId)
        assertEquals(true, transaction.categoryLocked)
    }

    @Test
    fun `recategorization marks existing incoming own-account transfer rows`() {
        val account = accounts.save(AccountEntity(name = "Velo", bucket = "accounts"))
        val transactionId = insertTransaction(
            accountId = account.id,
            description = "Przelew przychodzacy Rachunek nadawcy: PL00 1111 2222 3333 4444 5555 6666",
            counterparty = null,
            amount = "6000.00",
        )

        val result = ownTransferService.recategorize(account.id)

        assertEquals(1, result.categorized)
        assertEquals(1, result.changed)
        assertEquals(1, result.newlyCategorized)
        assertEquals(
            repository.listCategories().first { it.name == "Transfery" }.id,
            repository.listTransactions(account.id, onlyUncategorized = false, limit = 10).first { it.id == transactionId }.categoryId,
        )
    }

    @Test
    fun `recategorization falls back to llm when no rule matches`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        val transactionId = insertTransaction(
            accountId = account.id,
            description = "Nieznany bilet parkingowy centrum",
            counterparty = "PARKING TEST",
        )

        val result = llmFallbackService.recategorize(account.id)

        assertEquals(1, result.categorized)
        assertEquals(1, result.llmAttempted)
        assertEquals(1, result.llmCategorized)
        assertEquals(0, result.llmNoSuggestion)
        assertEquals(1, result.newlyCategorized)
        assertEquals(
            repository.listCategories().first { it.name == "Zakupy spozywcze" }.id,
            repository.listTransactions(account.id, onlyUncategorized = false, limit = 10).first { it.id == transactionId }.categoryId,
        )
    }

    private fun insertTransaction(
        accountId: java.util.UUID,
        description: String,
        counterparty: String?,
        amount: String = "-12.34",
    ): Long =
        jdbc.query(
            """
                insert into finance.transactions
                    (account_id, booked_at, amount, currency, description, counterparty, source, fingerprint, raw)
                values
                    (:accountId, :bookedAt, :amount, 'PLN', :description, :counterparty, 'test', :fingerprint, '{}'::jsonb)
                returning id
            """.trimIndent(),
            MapSqlParameterSource()
                .addValue("accountId", accountId)
                .addValue("bookedAt", Date.valueOf(LocalDate.of(2026, 5, 31)))
                .addValue("amount", BigDecimal(amount))
                .addValue("description", description)
                .addValue("counterparty", counterparty)
                .addValue("fingerprint", "$accountId-$description"),
        ) { rs, _ -> rs.getLong("id") }.first()

    companion object {
        @Container
        val postgres = PostgreSQLContainer("postgres:17")

        @JvmStatic
        @DynamicPropertySource
        fun datasourceProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
            registry.add("app.seed.enabled") { "false" }
        }
    }
}
