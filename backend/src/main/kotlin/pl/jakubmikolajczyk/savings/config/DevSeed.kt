package pl.jakubmikolajczyk.savings.config

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import pl.jakubmikolajczyk.savings.dto.AccountBucket
import pl.jakubmikolajczyk.savings.dto.AccountDto
import pl.jakubmikolajczyk.savings.dto.AccountSnapshotDto
import pl.jakubmikolajczyk.savings.dto.SettingsDto
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import pl.jakubmikolajczyk.savings.service.AccountService
import pl.jakubmikolajczyk.savings.service.SettingsService
import java.math.BigDecimal

/*
 * DEV SEED
 *
 * Runs only with:
 * - profile `local`,
 * - app.seed.enabled=true.
 *
 * INTERVIEW Q: "Why seed only local?"
 * A: Production data must be explicit and controlled. Seed data is useful for demos/dev,
 *    but dangerous if it silently appears in real finance tables.
 *
 * INTERVIEW Q: "ApplicationRunner vs CommandLineRunner?"
 * A: Both run after Spring starts. ApplicationRunner gives parsed ApplicationArguments;
 *    CommandLineRunner gives raw String[].
 */
@Component
@Profile("local")
@ConditionalOnProperty(prefix = "app.seed", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class DevSeed(
    private val accountRepository: AccountRepository,
    private val accountService: AccountService,
    private val settingsService: SettingsService,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        /*
         * Idempotent seed:
         * If accounts already exist, do nothing. Restarting local dev should not duplicate rows.
         */
        if (accountRepository.count() > 0) return

        val cash = accountService.create(AccountDto(name = "mBank", bucket = AccountBucket.cash, currency = "PLN"))
        val savings = accountService.create(AccountDto(name = "Obligacje", bucket = AccountBucket.investment, currency = "PLN"))

        /*
         * requireNotNull is better than `cash.id!!`.
         *
         * `!!` means "trust me, not null" and throws a NullPointerException if wrong.
         * requireNotNull throws IllegalArgumentException with our message, so the failure is clearer.
         *
         * INTERVIEW Q: "Why avoid !! in Kotlin?"
         * A: It punches a hole in null-safety. Use explicit checks, Elvis fallbacks, or requireNotNull.
         */
        val cashId = requireNotNull(cash.id) { "Saved account should have an id" }
        val savingsId = requireNotNull(savings.id) { "Saved account should have an id" }
        accountService.upsertSnapshot(cashId, "2026-05", AccountSnapshotDto(cashId, "2026-05", BigDecimal("12500.00")))
        accountService.upsertSnapshot(savingsId, "2026-05", AccountSnapshotDto(savingsId, "2026-05", BigDecimal("42000.00")))

        settingsService.put(
            SettingsDto(
                monthlyIncome = BigDecimal("14000"),
                monthlyExpenses = BigDecimal("6500"),
                startMonth = "2026-05",
                horizonMonths = 36,
                emergencyFundBuckets = listOf(AccountBucket.cash, AccountBucket.investment),
            ),
        )
    }
}
