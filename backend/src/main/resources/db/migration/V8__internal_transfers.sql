-- EPIC 12 follow-up: internal transfers are movement between own accounts,
-- not income and not spending.
--
-- The category is still visible in rollups as "Transfery", but contributes zero
-- to cashflow metrics. Raw transaction rows stay untouched for auditability.

drop view if exists finance.free_cash_per_cycle;

create or replace view finance.cycle_category_rollup as
select
    tx.account_id,
    tx.period_no,
    tx.period_start,
    tx.period_end,
    tx.is_partial,
    tx.category_id,
    case
        when tx.category_id is null then 'Bez kategorii'
        else category.name
    end as category_name,
    category.kind as category_kind,
    count(*)::int as transaction_count,
    coalesce(sum(case when category.name = 'Transfery' then 0 else tx.amount end), 0) as amount,
    coalesce(sum(case when tx.amount > 0 and coalesce(category.name, '') <> 'Transfery' then tx.amount else 0 end), 0) as income,
    coalesce(sum(case when tx.amount < 0 and coalesce(category.name, '') <> 'Transfery' then abs(tx.amount) else 0 end), 0) as expense
from finance.tx_with_period tx
left join finance.categories category on category.id = tx.category_id
group by
    tx.account_id,
    tx.period_no,
    tx.period_start,
    tx.period_end,
    tx.is_partial,
    tx.category_id,
    category.name,
    category.kind;

create view finance.free_cash_per_cycle as
select
    period.period_no,
    period.account_id,
    account.name as account_name,
    period.period_start,
    period.period_end,
    period.is_partial,
    coalesce(sum(rollup.income), 0) as income,
    coalesce(sum(case when rollup.category_kind = 'fixed' then rollup.expense else 0 end), 0) as fixed_expense,
    coalesce(sum(case when rollup.category_kind = 'recurring' then rollup.expense else 0 end), 0) as recurring_expense,
    coalesce(sum(case when rollup.category_kind in ('fixed', 'recurring') then rollup.expense else 0 end), 0) as committed_expense,
    coalesce(sum(case when rollup.category_kind = 'variable' then rollup.expense else 0 end), 0) as variable_expense,
    coalesce(sum(case when rollup.category_kind is null then rollup.expense else 0 end), 0) as uncategorized_expense,
    coalesce(sum(rollup.expense), 0) as total_expense,
    coalesce(sum(rollup.amount), 0) as net,
    coalesce(sum(rollup.income), 0)
        - coalesce(sum(case when rollup.category_kind in ('fixed', 'recurring') then rollup.expense else 0 end), 0)
        as free_cash
from finance.pay_periods period
join finance.accounts account on account.id = period.account_id
left join finance.cycle_category_rollup rollup
  on rollup.account_id = period.account_id
 and rollup.period_no = period.period_no
group by
    period.period_no,
    period.account_id,
    account.name,
    period.period_start,
    period.period_end,
    period.is_partial;
