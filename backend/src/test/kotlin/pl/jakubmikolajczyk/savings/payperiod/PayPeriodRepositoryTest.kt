package pl.jakubmikolajczyk.savings.payperiod

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
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorCreateDto
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.math.BigDecimal
import java.sql.Date
import java.time.LocalDate
import java.util.UUID

@DataJpaTest
@Testcontainers(disabledWithoutDocker = true)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PayPeriodRepositoryTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val jdbc: NamedParameterJdbcTemplate,
) {
    private val repository = PayPeriodRepository(jdbc)
    private val service = PayPeriodService(repository, accounts)

    @Test
    fun `refresh creates guarded pay periods and range-joins transactions`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        insertTransaction(account.id, "2026-01-01", "J1 SP ZOO", "Faktura J1", "10000.00")
        insertTransaction(account.id, "2026-01-10", "J1  SP   ZOO", "Druga faktura J1", "2000.00")
        insertTransaction(account.id, "2026-01-20", "J1 SP ZOO", "Faktura J1", "10000.00")
        insertTransaction(account.id, "2026-01-22", "BIEDRONKA", "Zakupy", "-123.45")

        val anchor = service.createAnchor(IncomeAnchorCreateDto(account.id, "j1 sp zoo"))
        assertNotNull(anchor.id)

        val periods = service.listPayPeriods(account.id, limit = 10).sortedBy { it.periodNo }

        assertEquals(2, periods.size)
        assertEquals("2026-01-01", periods[0].periodStart)
        assertEquals("2026-01-20", periods[0].periodEnd)
        assertEquals(BigDecimal("12000.00"), periods[0].income)
        assertEquals(BigDecimal("0"), periods[0].expense)

        assertEquals("2026-01-20", periods[1].periodStart)
        assertEquals(null, periods[1].periodEnd)
        assertEquals(BigDecimal("10000.00"), periods[1].income)
        assertEquals(BigDecimal("123.45"), periods[1].expense)
        assertEquals(BigDecimal("9876.55"), periods[1].net)
    }

    @Test
    fun `candidate detection groups normalized positive counterparties`() {
        val account = accounts.save(AccountEntity(name = "Velo", bucket = "accounts"))
        insertTransaction(account.id, "2026-03-01", "ACME  LTD", "Invoice", "5000.00")
        insertTransaction(account.id, "2026-04-01", "acme ltd", "Invoice", "5000.00")

        val candidate = service.listCandidates(limit = 10).first { it.counterparty == "acme ltd" }

        assertEquals(2, candidate.transactionCount)
        assertEquals(BigDecimal("10000.00"), candidate.totalIncome)
        assertEquals(false, candidate.alreadyAnchored)
    }

    private fun insertTransaction(
        accountId: UUID,
        bookedAt: String,
        counterparty: String,
        description: String,
        amount: String,
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
                .addValue("bookedAt", Date.valueOf(LocalDate.parse(bookedAt)))
                .addValue("amount", BigDecimal(amount))
                .addValue("description", description)
                .addValue("counterparty", counterparty)
                .addValue("fingerprint", "$accountId-$bookedAt-$amount-$description"),
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
