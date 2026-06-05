# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-05

First stable release. The app is feature-complete for everyday household
planning and net-worth tracking, with an optional backend for bank-data import.

### Added

- **Net worth overview** — total assets across seven buckets minus debts, with a
  month-over-month trend, an assets-by-bucket donut, and monthly cashflow cards.
- **Account snapshots over time** — net-worth history with account lifecycle
  (opened/closed), a configurable safety cushion (~6 months of costs) and a
  separate fast-access emergency fund.
- **Savings goals** — priorities, deadlines, fixed monthly allocations, and
  on-time / missed deadline tracking.
- **Loan and mortgage planning** — fixed-rate amortization with monthly and
  one-time overpayments (shorten term or reduce payment), a refinancing scenario
  with net-savings, and a full payoff schedule.
- **Next best action** — a single deterministic recommendation (no LLM) ranking
  cycle deficit → security buffers → IKZE → top goal → surplus.
- **Annual IKZE planner**, **credit-card tracker**, **subscriptions**,
  **upcoming expenses**, and an editable monthly schedule.
- **Local-first storage** — Zustand + localStorage with JSON import/export and
  no telemetry.
- **Optional Kotlin/Spring Boot backend** — PostgreSQL persistence, pay-period
  budgeting, category rules, leak analysis, and CSV/PDF bank-statement import.
- **Synthetic demo dataset** (`docs/demo-data.json`) and generator script so the
  app can be explored without real financial data.

[1.0.0]: https://github.com/Jakub-Mikolajczyk-pl/savings-planner/releases/tag/v1.0.0
