package pl.jakubmikolajczyk.savings.nudges

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.data.repository.findByIdOrNull
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import pl.jakubmikolajczyk.savings.dto.MortgagePlanDto
import pl.jakubmikolajczyk.savings.dto.SettingsDto
import pl.jakubmikolajczyk.savings.repository.AppSettingsRepository
import pl.jakubmikolajczyk.savings.repository.MortgagePlanRepository
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

/*
 * Nudges: aplikacja sama odzywa się na Telegramie we właściwym momencie,
 * zamiast czekać, aż user przypomni sobie o dashboardzie.
 *
 * Trzy przypomnienia:
 * 1. koniec miesiąca  -> które konta nie mają jeszcze snapshota za ten miesiąc,
 * 2. początek miesiąca -> ile zostało limitów IKZE/IKE w tym roku,
 * 3. początek miesiąca -> ostrzeżenie, gdy kończy się stała stopa hipoteki.
 */
@Service
class NudgeService(
    private val telegram: TelegramClient,
    private val jdbc: NamedParameterJdbcTemplate,
    private val settingsRepository: AppSettingsRepository,
    private val mortgageRepository: MortgagePlanRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(NudgeService::class.java)

    /* Ostatni dzień miesiąca, 18:00 — przypomnienie o snapshotach. */
    @Scheduled(cron = "0 0 18 L * *", zone = "Europe/Warsaw")
    fun monthEndSnapshotReminder() {
        if (!telegram.isConfigured) return
        val message = buildSnapshotReminder(LocalDate.now()) ?: return
        telegram.send(message)
    }

    /* 1. dzień miesiąca, 10:00 — limity emerytalne + alarm stałej stopy. */
    @Scheduled(cron = "0 0 10 1 * *", zone = "Europe/Warsaw")
    fun monthStartPlanningNudges() {
        if (!telegram.isConfigured) return
        buildRetirementNudge(LocalDate.now())?.let { telegram.send(it) }
        buildMortgageRateNudge(YearMonth.now())?.let { telegram.send(it) }
    }

    /** Konta aktywne bez snapshota w bieżącym miesiącu; null = wszystko wpisane. */
    fun buildSnapshotReminder(today: LocalDate): String? {
        val missing = jdbc.query(
            """
                select account.name
                from finance.accounts account
                where (account.closed_at is null or account.closed_at >= date_trunc('month', :today::date))
                  and not exists (
                    select 1 from finance.account_snapshots snapshot
                    where snapshot.account_id = account.id
                      and date_trunc('month', snapshot.snapshot_date) = date_trunc('month', :today::date)
                  )
                order by account.name
            """.trimIndent(),
            mapOf("today" to today),
        ) { rs, _ -> rs.getString("name") }

        if (missing.isEmpty()) return null
        val list = missing.joinToString("\n") { "• $it" }
        return "📒 <b>Koniec miesiąca — snapshoty</b>\n\nBez salda za ten miesiąc:\n$list\n\nhttp://savings.lan/#/majatek"
    }

    /** Pozostałe limity IKZE/IKE w bieżącym roku; null = brak planów albo wszystko domknięte. */
    fun buildRetirementNudge(today: LocalDate): String? {
        val settings = readSettings() ?: return null
        val year = today.year
        val monthsLeft = (12 - today.monthValue + 1).coerceAtLeast(1)

        val lines = mutableListOf<String>()
        for (plan in settings.ikzePlans.filter { it.year == year }) {
            val remaining = (plan.annualLimit - plan.contributedAmount).max(BigDecimal.ZERO)
            if (remaining > BigDecimal.ZERO) {
                lines += "• IKZE ${plan.ownerName}: zostało ${pln(remaining)} (~${pln(remaining.divide(BigDecimal(monthsLeft), 2, java.math.RoundingMode.UP))}/mc)"
            }
        }
        for (plan in settings.ikePlans.filter { it.year == year }) {
            val remaining = (plan.annualLimit - plan.contributedAmount).max(BigDecimal.ZERO)
            if (remaining > BigDecimal.ZERO) {
                lines += "• IKE ${plan.ownerName}: zostało ${pln(remaining)}"
            }
        }
        if (lines.isEmpty()) return null
        return "🐷 <b>Limity emerytalne $year</b>\n\n${lines.joinToString("\n")}\n\nhttp://savings.lan/#/plan"
    }

    /** Alarm, gdy stała stopa hipoteki kończy się w ciągu 3 miesięcy. */
    fun buildMortgageRateNudge(currentMonth: YearMonth): String? {
        val plan = readMortgagePlan() ?: return null
        val fixedUntil = plan.fixedRateUntil?.let { runCatching { YearMonth.parse(it) }.getOrNull() } ?: return null
        val monthsLeft = currentMonth.until(fixedUntil, java.time.temporal.ChronoUnit.MONTHS)
        if (monthsLeft < 0 || monthsLeft > 3) return null
        val margin = plan.bankMargin?.let { " (marża ${it}%)" } ?: ""
        return "🏠 <b>Hipoteka: koniec stałej stopy</b>\n\nStała stopa kończy się ${fixedUntil}$margin — za $monthsLeft mies. rata zacznie pływać z ${plan.referenceRateName ?: "WIBOR"}. Sprawdź scenariusze:\nhttp://savings.lan/#/plan"
    }

    /** Ręczny test z UI/cURL — wysyła wiadomość kontrolną. */
    fun sendTest(): Pair<Boolean, String> {
        if (!telegram.isConfigured) return false to "Telegram nie jest skonfigurowany (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID w .env)."
        val parts = listOfNotNull(
            buildSnapshotReminder(LocalDate.now()),
            buildRetirementNudge(LocalDate.now()),
            buildMortgageRateNudge(YearMonth.now()),
        )
        val message = if (parts.isEmpty()) {
            "✅ <b>savings-planner</b>: test nudges OK — nie ma dziś nic do przypomnienia."
        } else {
            parts.joinToString("\n\n")
        }
        val sent = telegram.send(message)
        return sent to if (sent) "Wysłano (${parts.size} przypomnień)." else "Telegram API odmówił — sprawdź logi backendu."
    }

    private fun readSettings(): SettingsDto? =
        settingsRepository.findByIdOrNull(1)?.payload?.let {
            runCatching { objectMapper.treeToValue(it, SettingsDto::class.java) }
                .onFailure { e -> log.warn("Cannot parse settings payload: {}", e.message) }
                .getOrNull()
        }

    private fun readMortgagePlan(): MortgagePlanDto? =
        mortgageRepository.findByIdOrNull(1)?.payload?.let {
            runCatching { objectMapper.treeToValue(it, MortgagePlanDto::class.java) }
                .onFailure { e -> log.warn("Cannot parse mortgage payload: {}", e.message) }
                .getOrNull()
        }

    private fun pln(value: BigDecimal): String =
        String.format(java.util.Locale.ROOT, "%,.2f", value).replace(',', ' ').replace('.', ',') + " zł"
}
