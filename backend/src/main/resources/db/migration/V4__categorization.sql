-- EPIC 9: deterministic transaction categorization.
--
-- transactions.category_id already exists from V3. This migration adds the
-- category dictionary, ordered matching rules, a manual-lock flag, and the FK.

create table finance.categories (
    id          bigint generated always as identity primary key,
    name        text not null,
    kind        text not null check (kind in ('variable','fixed','recurring')),
    parent_id   bigint references finance.categories(id),
    created_at  timestamptz not null default now()
);

create table finance.category_rules (
    id          bigint generated always as identity primary key,
    match_field text not null check (match_field in ('description','counterparty')),
    match_type  text not null check (match_type in ('contains','regex')),
    pattern     text not null,
    category_id bigint not null references finance.categories(id),
    priority    int  not null default 100,
    source      text not null default 'manual' check (source in ('manual','seed','llm')),
    created_at  timestamptz not null default now()
);

create index idx_category_rules_priority on finance.category_rules (priority, id);
create unique index uq_category_rules_match
    on finance.category_rules (match_field, match_type, lower(pattern));

alter table finance.transactions
    add column category_locked boolean not null default false;

alter table finance.transactions
    add constraint fk_transactions_category
    foreign key (category_id) references finance.categories(id);

create index idx_transactions_category_id on finance.transactions (category_id);
create index idx_transactions_uncategorized on finance.transactions (category_id)
    where category_id is null and category_locked = false;

insert into finance.categories (name, kind) values
    ('Zakupy spozywcze', 'variable'),
    ('Podatki i ZUS', 'fixed'),
    ('Media i internet', 'recurring'),
    ('Abonamenty', 'recurring'),
    ('Transport', 'variable'),
    ('Zdrowie', 'variable'),
    ('Przychody', 'fixed'),
    ('Transfery', 'variable'),
    ('Inne', 'variable');

insert into finance.category_rules (match_field, match_type, pattern, category_id, priority, source)
select rule.match_field, rule.match_type, rule.pattern, category.id, rule.priority, 'seed'
from (
    values
        ('counterparty', 'contains', 'biedronka', 'Zakupy spozywcze', 10),
        ('description', 'contains', 'biedronka', 'Zakupy spozywcze', 11),
        ('counterparty', 'contains', 'zabka', 'Zakupy spozywcze', 10),
        ('description', 'contains', 'zabka', 'Zakupy spozywcze', 11),
        ('counterparty', 'contains', 'lidl', 'Zakupy spozywcze', 10),
        ('description', 'contains', 'lidl', 'Zakupy spozywcze', 11),
        ('counterparty', 'contains', 'zus', 'Podatki i ZUS', 20),
        ('description', 'contains', 'zus', 'Podatki i ZUS', 21),
        ('counterparty', 'contains', 'urzad skarbowy', 'Podatki i ZUS', 20),
        ('description', 'contains', 'mikrorachunek podatkowy', 'Podatki i ZUS', 21),
        ('counterparty', 'contains', 'netia', 'Media i internet', 30),
        ('description', 'contains', 'netia', 'Media i internet', 31),
        ('counterparty', 'contains', 'netflix', 'Abonamenty', 40),
        ('counterparty', 'contains', 'spotify', 'Abonamenty', 40),
        ('counterparty', 'contains', 'google', 'Abonamenty', 45),
        ('counterparty', 'contains', 'apple.com', 'Abonamenty', 45),
        ('description', 'contains', 'bilet', 'Transport', 60),
        ('description', 'contains', 'apteka', 'Zdrowie', 70),
        ('description', 'contains', 'wynagrodzenie', 'Przychody', 80),
        ('description', 'contains', 'przelew wlasny', 'Transfery', 90)
) as rule(match_field, match_type, pattern, category_name, priority)
join finance.categories category on category.name = rule.category_name;
