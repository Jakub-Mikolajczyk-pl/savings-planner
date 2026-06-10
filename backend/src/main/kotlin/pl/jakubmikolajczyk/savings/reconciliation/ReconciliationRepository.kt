package pl.jakubmikolajczyk.savings.reconciliation

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import pl.jakubmikolajczyk.savings.dto.MonthlyActualsDto
import pl.jakubmikolajczyk.savings.dto.SnapshotSuggestionDto
import java.time.LocalDate
import java.util.UUID

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

    /*
     * Propozycje sald: dla kont bez snapshota w docelowym miesiącu liczymy
     * "ostatnie znane saldo + suma transakcji od tamtego miesiąca do końca
     * docelowego". Tylko konta, które mają jakiekolwiek transakcje w oknie —
     * konta prowadzone ręcznie (np. IKE u brokera) nie dostają propozycji.
     */
    fun snapshotSuggestions(targetMonthStart: LocalDate): List<SnapshotSuggestionDto> =
        jdbc.query(
            """
                select
                    account.id,
                    account.name,
                    base.snapshot_date as base_date,
                    coalesce(base.balance, 0) as base_balance,
                    coalesce(tx.delta, 0) as delta,
                    coalesce(tx.cnt, 0) as tx_count
                from finance.accounts account
                left join lateral (
                    select snapshot.snapshot_date, snapshot.balance
                    from finance.account_snapshots snapshot
                    where snapshot.account_id = account.id
                      and snapshot.snapshot_date < :targetMonth::date + interval '1 month'
                      and date_trunc('month', snapshot.snapshot_date) < :targetMonth::date
                    order by snapshot.snapshot_date desc
                    limit 1
                ) base on true
                left join lateral (
                    select sum(t.amount) as delta, count(*)::int as cnt
                    from finance.transactions t
                    where t.account_id = account.id
                      and t.booked_at >= coalesce(date_trunc('month', base.snapshot_date) + interval '1 month', '1900-01-01'::date)
                      and t.booked_at < :targetMonth::date + interval '1 month'
                ) tx on true
                where (account.closed_at is null or account.closed_at >= :targetMonth::date)
                  and coalesce(tx.cnt, 0) > 0
                  and not exists (
                    select 1 from finance.account_snapshots existing
                    where existing.account_id = account.id
                      and date_trunc('month', existing.snapshot_date) = :targetMonth::date
                  )
                order by account.name
            """.trimIndent(),
            mapOf("targetMonth" to targetMonthStart),
        ) { rs, _ ->
            val baseBalance = rs.getBigDecimal("base_balance")
            val delta = rs.getBigDecimal("delta")
            SnapshotSuggestionDto(
                accountId = rs.getObject("id", UUID::class.java),
                accountName = rs.getString("name"),
                yearMonth = "%04d-%02d".format(targetMonthStart.year, targetMonthStart.monthValue),
                baseYearMonth = rs.getDate("base_date")?.toLocalDate()?.let { "%04d-%02d".format(it.year, it.monthValue) },
                baseBalance = baseBalance,
                transactionsDelta = delta,
                suggestedBalance = baseBalance + delta,
                transactionCount = rs.getInt("tx_count"),
            )
        }
}
