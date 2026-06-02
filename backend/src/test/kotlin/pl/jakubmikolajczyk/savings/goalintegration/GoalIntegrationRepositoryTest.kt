package pl.jakubmikolajczyk.savings.goalintegration

import org.junit.jupiter.api.Assertions.assertEquals
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
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorCreateDto
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.payperiod.PayPeriodRepository
import pl.jakubmikolajczyk.savings.payperiod.PayPeriodService
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.math.BigDecimal
import java.sql.Date
import java.time.LocalDate
import java.util.UUID

@DataJpaTest
@Testcontainers(disabledWithoutDocker = true)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class GoalIntegrationRepositoryTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val jdbc: NamedParameterJdbcTemplate,
) {
    private val payPeriods = PayPeriodService(PayPeriodRepository(jdbc), accounts)
    private val repository = GoalIntegrationRepository(jdbc)

    @Test
    fun `free cash view subtracts only fixed and recurring costs from income`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        val fixedCategory = categoryId("Podatki i ZUS")
        val recurringCategory = categoryId("Media i internet")
        val variableCategory = categoryId("Zakupy spozywcze")
        val transferCategory = categoryId("Transfery")
        val savingsCategory = categoryId("Oszczednosci")

        insertTransaction(account.id, "2026-01-01", "Firma", "Wynagrodzenie", "5000.00")
        insertTransaction(account.id, "2026-02-01", "Firma", "Wynagrodzenie", "5000.00")
        insertTransaction(account.id, "2026-02-02", "ZUS", "Skladki", "-1200.00", fixedCategory)
        insertTransaction(account.id, "2026-02-03", "Netia", "Internet", "-100.00", recurringCategory)
        insertTransaction(account.id, "2026-02-04", "Biedronka", "Jedzenie", "-300.00", variableCategory)
        insertTransaction(account.id, "2026-02-05", "Mystery", "Bez kategorii", "-50.00")
        insertTransaction(account.id, "2026-02-06", "Alior", "Przelew wlasny Alior -> Velo", "6000.00", transferCategory)
        insertTransaction(account.id, "2026-02-07", "Alior", "Przelew wlasny Velo -> Alior", "-2000.00", transferCategory)
        insertTransaction(account.id, "2026-02-08", "IKZE", "Wplata na IKZE", "-700.00", savingsCategory)

        payPeriods.createAnchor(IncomeAnchorCreateDto(account.id, "Firma"))

        val cycle = repository.listFreeCashCycles(account.id, limit = 10)
            .single { it.periodNo == 2 }

        assertEquals(BigDecimal("5000.00"), cycle.income)
        assertEquals(BigDecimal("1200.00"), cycle.fixedExpense)
        assertEquals(BigDecimal("100.00"), cycle.recurringExpense)
        assertEquals(BigDecimal("1300.00"), cycle.committedExpense)
        assertEquals(BigDecimal("300.00"), cycle.variableExpense)
        assertEquals(BigDecimal("50.00"), cycle.uncategorizedExpense)
        assertEquals(BigDecimal("1650.00"), cycle.totalExpense)
        assertEquals(BigDecimal("700.00"), cycle.savingsContribution)
        assertEquals(BigDecimal("0"), cycle.savingsWithdrawal)
        assertEquals(BigDecimal("2650.00"), cycle.net)
        assertEquals(BigDecimal("3700.00"), cycle.freeCash)
    }

    private fun categoryId(name: String): Long =
        jdbc.query(
            "select id from finance.categories where name = :name",
            mapOf("name" to name),
        ) { rs, _ -> rs.getLong("id") }.single()

    private fun insertTransaction(
        accountId: UUID,
        bookedAt: String,
        counterparty: String,
        description: String,
        amount: String,
        categoryId: Long? = null,
    ): Long =
        jdbc.query(
            """
                insert into finance.transactions
                    (account_id, booked_at, amount, currency, description, counterparty, source, fingerprint, raw, category_id)
                values
                    (:accountId, :bookedAt, :amount, 'PLN', :description, :counterparty, 'test', :fingerprint, '{}'::jsonb, :categoryId)
                returning id
            """.trimIndent(),
            MapSqlParameterSource()
                .addValue("accountId", accountId)
                .addValue("bookedAt", Date.valueOf(LocalDate.parse(bookedAt)))
                .addValue("amount", BigDecimal(amount))
                .addValue("description", description)
                .addValue("counterparty", counterparty)
                .addValue("fingerprint", "$accountId-$bookedAt-$amount-$description")
                .addValue("categoryId", categoryId),
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
