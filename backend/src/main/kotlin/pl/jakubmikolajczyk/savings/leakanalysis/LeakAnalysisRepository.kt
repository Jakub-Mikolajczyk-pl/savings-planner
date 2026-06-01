package pl.jakubmikolajczyk.savings.leakanalysis

import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import pl.jakubmikolajczyk.savings.dto.CategoryKind
import pl.jakubmikolajczyk.savings.dto.CycleCategoryRollupDto
import pl.jakubmikolajczyk.savings.dto.MicroExpenseRollupDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodDto
import java.sql.ResultSet
import java.util.UUID

@Repository
class LeakAnalysisRepository(private val jdbc: NamedParameterJdbcTemplate) {
    /*
     * RowMapper is the manual, explicit cousin of JPA entity mapping.
     *
     * Why use it here instead of an @Entity for a view?
     * Analytical read models are often shaped for one screen, not for long-lived
     * persistence. A RowMapper makes the SQL contract visible right next to the DTO.
     */
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

    private val rollupMapper = RowMapper { rs: ResultSet, _: Int ->
        CycleCategoryRollupDto(
            categoryId = rs.getObject("category_id", java.lang.Long::class.java)?.toLong(),
            categoryName = rs.getString("category_name"),
            categoryKind = rs.getString("category_kind")?.let(CategoryKind::valueOf),
            amount = rs.getBigDecimal("amount"),
            income = rs.getBigDecimal("income"),
            expense = rs.getBigDecimal("expense"),
            transactionCount = rs.getInt("transaction_count"),
        )
    }

    private val microMapper = RowMapper { rs: ResultSet, _: Int ->
        MicroExpenseRollupDto(
            categoryId = rs.getObject("category_id", java.lang.Long::class.java)?.toLong(),
            categoryName = rs.getString("category_name"),
            categoryKind = rs.getString("category_kind")?.let(CategoryKind::valueOf),
            expense = rs.getBigDecimal("expense"),
            transactionCount = rs.getInt("transaction_count"),
        )
    }

    fun findPeriod(accountId: UUID, periodNo: Int): PayPeriodDto? =
        jdbc.query(
            """
                select
                    period.period_no,
                    period.account_id,
                    account.name as account_name,
                    period.period_start,
                    period.period_end,
                    period.anchor_tx_id,
                    period.is_partial,
                    coalesce(sum(case when tx.amount > 0 and coalesce(category.name, '') <> 'Transfery' then tx.amount else 0 end), 0) as income,
                    coalesce(sum(case when tx.amount < 0 and coalesce(category.name, '') <> 'Transfery' then abs(tx.amount) else 0 end), 0) as expense,
                    coalesce(sum(case when coalesce(category.name, '') = 'Transfery' then 0 else tx.amount end), 0) as net
                from finance.pay_periods period
                join finance.accounts account on account.id = period.account_id
                left join finance.tx_with_period tx
                  on tx.account_id = period.account_id and tx.period_no = period.period_no
                left join finance.categories category on category.id = tx.category_id
                where period.account_id = :accountId and period.period_no = :periodNo
                group by period.period_no, period.account_id, account.name, period.period_start,
                         period.period_end, period.anchor_tx_id, period.is_partial
            """.trimIndent(),
            params(accountId, periodNo),
            periodMapper,
        ).firstOrNull()

    fun categoryRollups(accountId: UUID, periodNo: Int): List<CycleCategoryRollupDto> =
        jdbc.query(
            """
                select category_id, category_name, category_kind, amount, income, expense, transaction_count
                from finance.cycle_category_rollup
                where account_id = :accountId and period_no = :periodNo
                order by expense desc, abs(amount) desc, category_name
            """.trimIndent(),
            params(accountId, periodNo),
            rollupMapper,
        )

    fun microExpenses(accountId: UUID, periodNo: Int): List<MicroExpenseRollupDto> =
        jdbc.query(
            """
                select
                    tx.category_id,
                    coalesce(category.name, 'Bez kategorii') as category_name,
                    category.kind as category_kind,
                    count(*)::int as transaction_count,
                    sum(abs(tx.amount)) as expense
                from finance.tx_with_period tx
                left join finance.categories category on category.id = tx.category_id
                where tx.account_id = :accountId
                  and tx.period_no = :periodNo
                  and tx.amount < 0
                  and abs(tx.amount) < 50
                group by tx.category_id, category.name, category.kind
                order by expense desc, transaction_count desc, category_name
            """.trimIndent(),
            params(accountId, periodNo),
            microMapper,
        )

    fun recurringSamples(accountId: UUID): List<LeakTransactionSample> =
        jdbc.query(
            """
                select
                    tx.id,
                    tx.booked_at,
                    tx.amount,
                    coalesce(nullif(trim(tx.counterparty), ''), tx.description) as counterparty,
                    tx.period_no,
                    tx.category_id,
                    category.name as category_name,
                    category.kind as category_kind
                from finance.tx_with_period tx
                left join finance.categories category on category.id = tx.category_id
                where tx.account_id = :accountId
                  and tx.period_no is not null
                  and tx.amount < 0
                order by tx.booked_at, tx.id
            """.trimIndent(),
            mapOf("accountId" to accountId),
        ) { rs, _ ->
            /*
             * `getInt` returns 0 both for SQL NULL and real 0. Here period_no is
             * filtered as NOT NULL above, so the primitive getter is fine.
             */
            LeakTransactionSample(
                id = rs.getLong("id"),
                bookedAt = rs.getDate("booked_at").toLocalDate(),
                amount = rs.getBigDecimal("amount"),
                counterparty = rs.getString("counterparty"),
                periodNo = rs.getInt("period_no"),
                categoryId = rs.getObject("category_id", java.lang.Long::class.java)?.toLong(),
                categoryName = rs.getString("category_name"),
                categoryKind = rs.getString("category_kind")?.let(CategoryKind::valueOf),
            )
        }

    fun categoryExpensePoints(accountId: UUID): List<CategoryExpensePoint> =
        jdbc.query(
            """
                select period_no, is_partial, category_id, category_name, category_kind, expense
                from finance.cycle_category_rollup
                where account_id = :accountId
                  and period_no is not null
                  and expense > 0
                order by period_no, category_name
            """.trimIndent(),
            mapOf("accountId" to accountId),
        ) { rs, _ ->
            CategoryExpensePoint(
                periodNo = rs.getInt("period_no"),
                isPartial = rs.getBoolean("is_partial"),
                categoryId = rs.getObject("category_id", java.lang.Long::class.java)?.toLong(),
                categoryName = rs.getString("category_name"),
                categoryKind = rs.getString("category_kind")?.let(CategoryKind::valueOf),
                expense = rs.getBigDecimal("expense"),
            )
        }

    private fun params(accountId: UUID, periodNo: Int) = MapSqlParameterSource()
        .addValue("accountId", accountId)
        .addValue("periodNo", periodNo)
}
