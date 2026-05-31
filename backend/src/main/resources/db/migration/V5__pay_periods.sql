-- EPIC 10: budget periods anchored by real income transactions.
--
-- We intentionally keep pay_periods as a recalculated table, not a materialized
-- view. The min_cycle_days guard depends on the last accepted anchor, which is
-- easier to express and test in Kotlin than in recursive SQL.

create table finance.income_anchors (
    id           bigint generated always as identity primary key,
    account_id   uuid not null references finance.accounts(id) on delete cascade,
    counterparty text not null,
    created_at   timestamptz not null default now(),
    constraint uq_income_anchors_account_counterparty unique (account_id, counterparty)
);

create index idx_income_anchors_account_id on finance.income_anchors (account_id);

create table finance.pay_period_settings (
    id             integer primary key default 1,
    min_cycle_days integer not null default 14,
    constraint pay_period_settings_singleton check (id = 1),
    constraint pay_period_settings_min_cycle_days_check check (min_cycle_days >= 1)
);

insert into finance.pay_period_settings (id, min_cycle_days)
values (1, 14);

create table finance.pay_periods (
    id            bigint generated always as identity primary key,
    period_no     integer not null,
    account_id    uuid not null references finance.accounts(id) on delete cascade,
    period_start  date not null,
    period_end    date,
    anchor_tx_id  bigint not null references finance.transactions(id) on delete cascade,
    is_partial    boolean not null default false,
    created_at    timestamptz not null default now(),
    constraint uq_pay_periods_account_period_no unique (account_id, period_no),
    constraint uq_pay_periods_account_period_start unique (account_id, period_start),
    constraint pay_periods_range_check check (period_end is null or period_end > period_start)
);

create index idx_pay_periods_account_start on finance.pay_periods (account_id, period_start);
create index idx_pay_periods_anchor_tx_id on finance.pay_periods (anchor_tx_id);

create view finance.tx_with_period as
select
    tx.id,
    tx.account_id,
    tx.booked_at,
    tx.amount,
    tx.currency,
    tx.description,
    tx.counterparty,
    tx.source,
    tx.fingerprint,
    tx.raw,
    tx.category_id,
    tx.category_locked,
    tx.created_at,
    period.period_no,
    period.period_start,
    period.period_end,
    period.is_partial
from finance.transactions tx
left join finance.pay_periods period
  on period.account_id = tx.account_id
 and tx.booked_at >= period.period_start
 and (period.period_end is null or tx.booked_at < period.period_end);
