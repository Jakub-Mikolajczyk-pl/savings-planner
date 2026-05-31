package pl.jakubmikolajczyk.savings.leakanalysis

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
class LeakAnalysisRepositoryTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val jdbc: NamedParameterJdbcTemplate,
) {
    private val payPeriods = PayPeriodService(PayPeriodRepository(jdbc), accounts)
    private val repository = LeakAnalysisRepository(jdbc)

    @Test
    fun `cycle category rollup keeps uncategorized rows visible and reconciles net`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        val groceriesCategory = categoryId("Zakupy spozywcze")

        insertTransaction(account.id, "2026-01-01", "J1", "Invoice", "1000.00")
        insertTransaction(account.id, "2026-02-01", "J1", "Invoice", "1000.00")
        insertTransaction(account.id, "2026-02-05", "Biedronka", "Zakupy", "-40.00", groceriesCategory)
        insertTransaction(account.id, "2026-02-06", "Mystery", "Bez reguly", "-20.00")

        payPeriods.createAnchor(IncomeAnchorCreateDto(account.id, "J1"))

        val period = repository.findPeriod(account.id, periodNo = 2)!!
        val rollups = repository.categoryRollups(account.id, periodNo = 2)
        val micro = repository.microExpenses(account.id, periodNo = 2)

        assertEquals(BigDecimal("940.00"), period.net)
        assertEquals(BigDecimal("940.00"), rollups.fold(BigDecimal.ZERO) { sum, row -> sum + row.amount })
        assertEquals(1, rollups.count { it.categoryName == "Bez kategorii" })
        assertEquals(BigDecimal("60.00"), micro.fold(BigDecimal.ZERO) { sum, row -> sum + row.expense })
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

