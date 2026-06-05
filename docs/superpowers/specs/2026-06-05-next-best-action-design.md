# Next Best Action Design

## Goal

Add a deterministic "Następny najlepszy ruch" panel to the Plan page. It should answer what to do with the next cycle's available money without sending financial data to an external LLM.

## Decision Model

The recommendation engine is algorithmic and pure TypeScript. It consumes already-computed domain models:

- `NextCycleForecast` for next-cycle cashflow and credit-card repayment.
- `SecurityBuffersModel` for emergency fund and safety cushion gaps.
- `Settings` for IKZE plans.
- `Goal[]` for manual goals.

Ranking:

1. If next-cycle free cash after credit-card repayment is negative, recommend covering the deficit before saving.
2. If a security buffer is missing, recommend topping up the first missing buffer, capped by available free cash.
3. If security is met and IKZE has remaining annual room, recommend the per-payout IKZE contribution, capped by available free cash.
4. If manual goals remain, recommend funding the highest-priority incomplete goal, capped by available free cash.
5. If no target needs money, recommend keeping the surplus available.

## LLM Boundary

No LLM decides amounts, ranking, or financial advice. A future local model can implement a `RecommendationNarrator` interface that rewrites a prepared deterministic summary. The default V1 UI uses template copy only.

## UI

Add a compact Plan section above the security panel. It shows:

- action title,
- recommended amount,
- confidence,
- short reason list,
- expected effect list,
- "Algorytm" badge to make provenance explicit.

Use existing `SectionCard` styling and restrained borders. No hero treatment, no fake AI decoration.

## Testing

Add domain tests for:

- deficit before any savings,
- security buffer before IKZE/manual goals,
- IKZE after security is met,
- manual goal fallback,
- surplus fallback when nothing needs funding.
