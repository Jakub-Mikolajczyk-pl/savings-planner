package pl.jakubmikolajczyk.savings.reconciliation

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import pl.jakubmikolajczyk.savings.dto.MonthlyActualsDto

/*
 * Plan vs wykonanie: agregaty kalendarzowych miesięcy z finance.transactions.
 *
 * Semantyka spójna z leak analysis:
 * - internal_transfer nie liczy się nigdzie (własne przelewy między kontami),
 * - savings to nie wydatek: ujemne kwoty = wpłaty na oszczędności,
 *   dodatnie = wypłaty z oszczędności,
 * - brak kategorii traktujemy jak 'expense' (i raportujemy licznik, żeby
 *   user wiedział, ile transakcji czeka na kategoryzację).
 */
@Repository
class ReconciliationRepository(private val jdbc: NamedParameterJdbcTemplate) {

    fun monthlyActuals(months: Int): List<MonthlyActualsDto> =
        jdbc.query(
            """
                select
                    to_char(date_trunc('month', tx.booked_at), 'YYYY-MM') as year_month,
                    coalesce(sum(case
                        when tx.amount > 0
                         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
                        then tx.amount else 0 end), 0) as income,
                    coalesce(sum(case
                        when tx.amount < 0
                         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
                        then abs(tx.amount) else 0 end), 0) as expense,
                    coalesce(sum(case
                        when tx.amount < 0
                         and coalesce(category.cashflow_treatment, 'expense') = 'savings'
                        then abs(tx.amount) else 0 end), 0) as savings_contribution,
                    coalesce(sum(case
                        when tx.amount > 0
                         and coalesce(category.cashflow_treatment, 'expense') = 'savings'
                        then tx.amount else 0 end), 0) as savings_withdrawal,
                    (count(*) filter (where tx.category_id is null))::int as uncategorized_count,
                    count(*)::int as transaction_count
                from finance.transactions tx
                left join finance.categories category on category.id = tx.category_id
                where tx.booked_at >= date_trunc('month', current_date) - make_interval(months => :months)
                group by 1
                order by 1
            """.trimIndent(),
            mapOf("months" to months),
        ) { rs, _ ->
            MonthlyActualsDto(
                yearMonth = rs.getString("year_month"),
                income = rs.getBigDecimal("income"),
                expense = rs.getBigDecimal("expense"),
                savingsContribution = rs.getBigDecimal("savings_contribution"),
                savingsWithdrawal = rs.getBigDecimal("savings_withdrawal"),
                uncategorizedCount = rs.getInt("uncategorized_count"),
                transactionCount = rs.getInt("transaction_count"),
            )
        }
}
