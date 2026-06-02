package pl.jakubmikolajczyk.savings.payperiod

import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorCandidateDto
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodSettingsDto
import java.sql.ResultSet
import java.util.Locale
import java.util.UUID

@Repository
class PayPeriodRepository(private val jdbc: NamedParameterJdbcTemplate) {
    private val anchorMapper = RowMapper { rs: ResultSet, _: Int ->
        IncomeAnchorDto(
            id = rs.getLong("id"),
            accountId = rs.getObject("account_id", UUID::class.java),
            accountName = rs.getString("account_name"),
            counterparty = rs.getString("counterparty"),
            createdAt = rs.getTimestamp("created_at").toInstant().toString(),
        )
    }

    private val candidateMapper = RowMapper { rs: ResultSet, _: Int ->
        IncomeAnchorCandidateDto(
            accountId = rs.getObject("account_id", UUID::class.java),
            accountName = rs.getString("account_name"),
            counterparty = rs.getString("counterparty"),
            transactionCount = rs.getInt("transaction_count"),
            firstBookedAt = rs.getDate("first_booked_at").toLocalDate().toString(),
            lastBookedAt = rs.getDate("last_booked_at").toLocalDate().toString(),
            totalIncome = rs.getBigDecimal("total_income"),
            alreadyAnchored = rs.getBoolean("already_anchored"),
        )
    }

    private val periodMapper = RowMapper { rs: ResultSet, _: Int ->
        PayPeriodDto(
            periodNo = rs.getInt("period_no"),
            accountId = rs.getObject("account_id", UUID::class.java),
            accountName = rs.getString("account_name"),
            periodStart = rs.getDate("period_start").toLocalDate().toString(),
            periodEnd = rs.getDate("period_end")?.toLocalDate()?.toString(),
            anchorTxId = rs.getLong("anchor_tx_id"),
            isPartial = rs.getBoolean("is_partial"),
            income = rs.getBigDecimal("income"),
            expense = rs.getBigDecimal("expense"),
            net = rs.getBigDecimal("net"),
        )
    }

    fun listAnchors(): List<IncomeAnchorDto> =
        jdbc.query(
            """
                select anchor.id, anchor.account_id, account.name as account_name, anchor.counterparty, anchor.created_at
                from finance.income_anchors anchor
                join finance.accounts account on account.id = anchor.account_id
                order by lower(account.name), anchor.counterparty
            """.trimIndent(),
            anchorMapper,
        )

    fun listCandidates(limit: Int): List<IncomeAnchorCandidateDto> =
        jdbc.query(
            """
                with normalized as (
                    select
                        tx.account_id,
                        account.name as account_name,
                        lower(regexp_replace(trim(tx.counterparty), '[[:space:]]+', ' ', 'g')) as counterparty,
                        tx.booked_at,
                        tx.amount
                    from finance.transactions tx
                    join finance.accounts account on account.id = tx.account_id
                    where tx.amount > 0
                      and nullif(trim(coalesce(tx.counterparty, '')), '') is not null
                )
                select
                    normalized.account_id,
                    normalized.account_name,
                    normalized.counterparty,
                    count(*)::int as transaction_count,
                    min(normalized.booked_at) as first_booked_at,
                    max(normalized.booked_at) as last_booked_at,
                    sum(normalized.amount) as total_income,
                    exists (
                        select 1
                        from finance.income_anchors anchor
                        where anchor.account_id = normalized.account_id
                          and anchor.counterparty = normalized.counterparty
                    ) as already_anchored
                from normalized
                group by normalized.account_id, normalized.account_name, normalized.counterparty
                order by already_anchored desc, transaction_count desc, last_booked_at desc
                limit :limit
            """.trimIndent(),
            mapOf("limit" to limit.coerceIn(1, 100)),
            candidateMapper,
        )

    fun createAnchor(accountId: UUID, counterparty: String): IncomeAnchorDto {
        val normalized = normalizeCounterparty(counterparty)
        jdbc.update(
            """
                insert into finance.income_anchors (account_id, counterparty)
                values (:accountId, :counterparty)
                on conflict (account_id, counterparty) do nothing
            """.trimIndent(),
            mapOf("accountId" to accountId, "counterparty" to normalized),
        )
        return findAnchor(accountId, normalized)!!
    }

    fun findAnchor(accountId: UUID, counterparty: String): IncomeAnchorDto? =
        jdbc.query(
            """
                select anchor.id, anchor.account_id, account.name as account_name, anchor.counterparty, anchor.created_at
                from finance.income_anchors anchor
                join finance.accounts account on account.id = anchor.account_id
                where anchor.account_id = :accountId and anchor.counterparty = :counterparty
            """.trimIndent(),
            mapOf("accountId" to accountId, "counterparty" to normalizeCounterparty(counterparty)),
            anchorMapper,
        ).firstOrNull()

    fun deleteAnchor(id: Long): Int =
        jdbc.update("delete from finance.income_anchors where id = :id", mapOf("id" to id))

    fun settings(): PayPeriodSettingsDto =
        jdbc.query(
            "select min_cycle_days from finance.pay_period_settings where id = 1",
            emptyMap<String, Any>(),
        ) { rs, _ -> PayPeriodSettingsDto(minCycleDays = rs.getInt("min_cycle_days")) }.first()

    fun updateSettings(dto: PayPeriodSettingsDto): PayPeriodSettingsDto {
        jdbc.update(
            """
                insert into finance.pay_period_settings (id, min_cycle_days)
                values (1, :minCycleDays)
                on conflict (id) do update set min_cycle_days = excluded.min_cycle_days
            """.trimIndent(),
            mapOf("minCycleDays" to dto.minCycleDays),
        )
        return settings()
    }

    fun anchorTransactions(): List<IncomeAnchorTransaction> =
        jdbc.query(
            """
                select tx.id, tx.account_id, tx.booked_at
                from finance.transactions tx
                join finance.income_anchors anchor
                  on anchor.account_id = tx.account_id
                 and anchor.counterparty = lower(regexp_replace(trim(tx.counterparty), '[[:space:]]+', ' ', 'g'))
                where tx.amount > 0
                order by tx.account_id, tx.booked_at, tx.id
            """.trimIndent(),
        ) { rs, _ ->
            IncomeAnchorTransaction(
                transactionId = rs.getLong("id"),
                accountId = rs.getObject("account_id", UUID::class.java),
                bookedAt = rs.getDate("booked_at").toLocalDate(),
            )
        }

    fun replacePayPeriods(periods: List<CalculatedPayPeriod>) {
        jdbc.update("delete from finance.pay_periods", emptyMap<String, Any>())
        if (periods.isEmpty()) return

        jdbc.batchUpdate(
            """
                insert into finance.pay_periods
                    (period_no, account_id, period_start, period_end, anchor_tx_id, is_partial)
                values
                    (:periodNo, :accountId, :periodStart, :periodEnd, :anchorTxId, :isPartial)
            """.trimIndent(),
            periods.map { period ->
                MapSqlParameterSource()
                    .addValue("periodNo", period.periodNo)
                    .addValue("accountId", period.accountId)
                    .addValue("periodStart", period.periodStart)
                    .addValue("periodEnd", period.periodEnd)
                    .addValue("anchorTxId", period.anchorTxId)
                    .addValue("isPartial", period.isPartial)
            }.toTypedArray(),
        )
    }

    fun listPayPeriods(accountId: UUID?, limit: Int): List<PayPeriodDto> {
        val where = if (accountId == null) "" else "where period.account_id = :accountId"
        return jdbc.query(
            """
                select
                    period.period_no,
                    period.account_id,
                    account.name as account_name,
                    period.period_start,
                    period.period_end,
                    period.anchor_tx_id,
                    period.is_partial,
                    coalesce(sum(case
                        when tx.amount > 0
                         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
                        then tx.amount else 0 end), 0) as income,
                    coalesce(sum(case
                        when tx.amount < 0
                         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
                        then abs(tx.amount) else 0 end), 0) as expense,
                    coalesce(sum(case
                        when coalesce(category.cashflow_treatment, 'expense') = 'internal_transfer' then 0
                        else tx.amount end), 0) as net
                from finance.pay_periods period
                join finance.accounts account on account.id = period.account_id
                left join finance.tx_with_period tx
                  on tx.account_id = period.account_id and tx.period_no = period.period_no
                left join finance.categories category on category.id = tx.category_id
                $where
                group by period.period_no, period.account_id, account.name, period.period_start,
                         period.period_end, period.anchor_tx_id, period.is_partial
                order by period.period_start desc, period.account_id
                limit :limit
            """.trimIndent(),
            MapSqlParameterSource()
                .addValue("accountId", accountId)
                .addValue("limit", limit.coerceIn(1, 500)),
            periodMapper,
        )
    }
}

fun normalizeCounterparty(counterparty: String): String =
    counterparty.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)
