package pl.jakubmikolajczyk.savings.ingest

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.math.BigDecimal
import java.time.LocalDate

@DataJpaTest
@Testcontainers(disabledWithoutDocker = true)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TransactionUpsertRepositoryTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val jdbc: NamedParameterJdbcTemplate,
) {
    private val repository = TransactionUpsertRepository(jdbc, ObjectMapper())

    @Test
    fun `inserts once and skips duplicate fingerprint`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))
        val tx = CanonicalTx(
            bookedAt = LocalDate.of(2022, 12, 30),
            amount = BigDecimal("-17.60"),
            currency = "PLN",
            description = "Oplata za autostrade",
            counterparty = "BLUE MEDIA SA",
            raw = mapOf("Szczegóły transakcji" to "Oplata za autostrade"),
        )
        val insert = TransactionInsert(
            accountId = account.id,
            source = "alior_csv",
            fingerprint = "same-fingerprint",
            tx = tx,
        )

        assertEquals(true, repository.insertIgnoreDuplicate(insert))
        assertEquals(false, repository.insertIgnoreDuplicate(insert))

        val count = jdbc.queryForObject("select count(*) from finance.transactions", emptyMap<String, Any>(), Long::class.java)
        assertEquals(1L, count)
    }

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
