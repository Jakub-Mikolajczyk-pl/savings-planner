-- Subscription billing period + shared (family) cost.
--
-- `monthly_amount` stays the canonical effective monthly cost (already
-- normalized to a month and already divided by the number of people sharing).
-- The cashflow engine keeps reading that single column, so nothing downstream
-- changes. The columns below only capture the *input intent* so the form can
-- round-trip an edit (yearly billing, family split) without re-deriving it.
--
-- All nullable: legacy rows keep working as plain monthly, full-cost subs.

alter table finance.subscriptions
    add column billing_period text,        -- 'monthly' | 'yearly'; null => monthly (legacy)
    add column billing_amount numeric(10, 2), -- full amount charged per billing period, before any split
    add column shared boolean,             -- true => family/shared subscription
    add column share_count integer;        -- number of people splitting (incl. user); effective = billing_amount/period / share_count
