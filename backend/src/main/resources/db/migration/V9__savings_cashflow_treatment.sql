-- Add a second category axis for cashflow semantics.
--
-- `kind` still answers "what kind of expense is this?".
-- `cashflow_treatment` answers "does this row affect spending, income,
-- transfers, or savings movement?". Savings contributions are visible as
-- money moved aside, but no longer count as expense/leak.

alter table finance.categories
    add column cashflow_treatment text not null default 'expense';

alter table finance.categories
    add constraint categories_cashflow_treatment_check
    check (cashflow_treatment in ('expense', 'income', 'internal_transfer', 'savings'));

update finance.categories
set cashflow_treatment = 'internal_transfer'
where lower(name) = 'transfery';

update finance.categories
set cashflow_treatment = 'income'
where lower(name) = 'przychody';

update finance.categories
set cashflow_treatment = 'savings'
where lower(name) in ('oszczednosci', 'oszczędności', 'ikze', 'ike')
   or lower(name) like '%ikze%'
   or lower(name) like '%ike%'
   or lower(name) like '%oszczedn%'
   or lower(name) like '%oszczędn%';

insert into finance.categories (name, kind, cashflow_treatment)
select 'Oszczednosci', 'variable', 'savings'
where not exists (
    select 1
    from finance.categories
    where lower(name) in ('oszczednosci', 'oszczędności')
);

drop view if exists finance.free_cash_per_cycle;
drop view if exists finance.cycle_category_rollup;

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
    coalesce(category.cashflow_treatment, 'expense') as cashflow_treatment,
    count(*)::int as transaction_count,
    coalesce(sum(case
        when coalesce(category.cashflow_treatment, 'expense') = 'internal_transfer' then 0
        else tx.amount
    end), 0) as amount,
    coalesce(sum(case
        when tx.amount > 0
         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
        then tx.amount
        else 0
    end), 0) as income,
    coalesce(sum(case
        when tx.amount < 0
         and coalesce(category.cashflow_treatment, 'expense') not in ('internal_transfer', 'savings')
        then abs(tx.amount)
        else 0
    end), 0) as expense,
    coalesce(sum(case
        when tx.amount < 0
         and coalesce(category.cashflow_treatment, 'expense') = 'savings'
        then abs(tx.amount)
        else 0
    end), 0) as savings_contribution,
    coalesce(sum(case
        when tx.amount > 0
         and coalesce(category.cashflow_treatment, 'expense') = 'savings'
        then tx.amount
        else 0
    end), 0) as savings_withdrawal
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
    category.kind,
    category.cashflow_treatment;

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
    coalesce(sum(rollup.savings_contribution), 0) as savings_contribution,
    coalesce(sum(rollup.savings_withdrawal), 0) as savings_withdrawal,
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
