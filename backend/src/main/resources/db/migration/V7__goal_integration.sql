-- EPIC 12: free cash per real pay cycle.
--
-- `cycle_category_rollup` already reconciles transaction amounts per category.
-- This view names the budgeting decision explicitly:
--   free_cash = income - fixed costs - recurring costs
--
-- Variable and uncategorized spending is deliberately kept separate. It is not
-- part of "committed" costs, but it explains how much of the free cash was
-- actually consumed before the final net result.

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
