-- Bank statement ingest is deliberately separate from the old Google Sheets importer.
-- This table stores canonical bank transactions and deduplicates overlapping exports.

create table finance.transactions (
    id bigint generated always as identity primary key,
    account_id uuid not null references finance.accounts(id) on delete cascade,
    booked_at date not null,
    amount numeric(14,2) not null,
    currency char(3) not null default 'PLN',
    description text not null default '',
    counterparty text,
    source text not null,
    fingerprint text not null,
    raw jsonb not null,
    category_id bigint,
    created_at timestamptz not null default now(),
    constraint uq_transactions_fingerprint unique (fingerprint)
);

create index idx_transactions_booked_at on finance.transactions (booked_at);
create index idx_transactions_account_id on finance.transactions (account_id);
