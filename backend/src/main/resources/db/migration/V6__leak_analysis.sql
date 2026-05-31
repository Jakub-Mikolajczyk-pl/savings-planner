-- EPIC 11: cycle leak analysis.
--
-- This view is intentionally boring SQL: one row per account + pay period +
-- category. Keeping it as a view means every recategorize/import is visible
-- immediately; the expensive heuristics (recurring/delta) live in Kotlin where
-- they are easier to explain and unit-test.

create view finance.cycle_category_rollup as
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
    coalesce(sum(tx.amount), 0) as amount,
    coalesce(sum(case when tx.amount > 0 then tx.amount else 0 end), 0) as income,
    coalesce(sum(case when tx.amount < 0 then abs(tx.amount) else 0 end), 0) as expense
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

