create schema if not exists finance;

create table finance.accounts (
    id uuid primary key,
    name text not null,
    bucket text not null,
    currency text not null default 'PLN',
    opened_at date,
    closed_at date,
    created_at timestamptz not null default now(),
    constraint accounts_bucket_check check (bucket in ('cash', 'investment', 'retirement', 'down_payment', 'crypto'))
);

create table finance.account_snapshots (
    id uuid primary key,
    account_id uuid not null references finance.accounts(id) on delete cascade,
    snapshot_date date not null,
    balance numeric(14,2) not null,
    notes text,
    created_at timestamptz not null default now(),
    unique (account_id, snapshot_date)
);

create index account_snapshots_snapshot_date_idx on finance.account_snapshots (snapshot_date);
create index account_snapshots_account_id_idx on finance.account_snapshots (account_id);

create table finance.debts (
    id uuid primary key,
    name text not null,
    remaining_balance numeric(14,2) not null,
    monthly_payment numeric(14,2) not null,
    kind text not null default 'installment'
);

create table finance.subscriptions (
    id uuid primary key,
    name text not null,
    monthly_amount numeric(10,2) not null,
    active boolean not null default true,
    category text,
    next_charge date
);

create table finance.upcoming_expenses (
    id uuid primary key,
    name text not null,
    amount numeric(12,2) not null,
    target_month date not null,
    is_paid boolean not null default false
);

create table finance.goals (
    id uuid primary key,
    name text not null,
    target_amount numeric(14,2) not null,
    deadline date,
    priority integer not null,
    fixed_allocation numeric(12,2),
    current_saved numeric(14,2) default 0
);

create table finance.mortgage_plan (
    id integer primary key,
    payload jsonb not null
);

create table finance.app_settings (
    id integer primary key,
    payload jsonb not null
);

create table finance.planner_overrides (
    id integer primary key,
    payload jsonb not null
);

