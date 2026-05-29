package pl.jakubmikolajczyk.savings.repository

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.entity.AccountSnapshotEntity
import java.math.BigDecimal
import java.time.LocalDate

@DataJpaTest
@Testcontainers(disabledWithoutDocker = true)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RepositoryIntegrationTest @Autowired constructor(
    private val accounts: AccountRepository,
    private val snapshots: AccountSnapshotRepository,
) {
    @Test
    fun `persists account and finds ordered snapshots`() {
        val account = accounts.save(AccountEntity(name = "mBank", bucket = "accounts"))
        snapshots.save(AccountSnapshotEntity(account = account, snapshotDate = LocalDate.of(2026, 5, 1), balance = BigDecimal("100.00")))
        snapshots.save(AccountSnapshotEntity(account = account, snapshotDate = LocalDate.of(2026, 4, 1), balance = BigDecimal("50.00")))

        val history = snapshots.findByAccountIdOrderBySnapshotDate(account.id)

        assertEquals(listOf("50.00", "100.00"), history.map { it.balance.setScale(2).toPlainString() })
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
