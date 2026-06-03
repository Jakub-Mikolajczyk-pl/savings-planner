import { describe, expect, it } from 'vitest'
import {
  buildDefaultIkzePlans,
  summarizeIkzePlans,
  calculateIkzeEntry,
  ikzeMonthlyContributionCost,
  payoutsLeftToYearEnd,
} from './ikze'
import type { IkzePlanEntry } from './types'

describe('IKZE planner', () => {
  it('marks an entry without an annual limit as missing limit', () => {
    const result = calculateIkzeEntry({
      id: 'ikze-jakub',
      year: 2026,
      ownerName: 'Jakub',
      role: 'entrepreneur',
      annualLimit: 0,
      contributedAmount: 1200,
      payoutsLeft: 6,
    })

    expect(result.status).toBe('missing_limit')
    expect(result.remaining).toBe(0)
    expect(result.perPayout).toBe(0)
  })

  it('calculates remaining amount and rounds per-payout recommendation up to grosze', () => {
    const result = calculateIkzeEntry({
      id: 'ikze-zona',
      year: 2026,
      ownerName: 'Zona',
      role: 'employee',
      annualLimit: 1000,
      contributedAmount: 100,
      payoutsLeft: 7,
    })

    expect(result.status).toBe('in_progress')
    expect(result.remaining).toBe(900)
    expect(result.perPayout).toBe(128.58)
  })

  it('handles completed, over-limit, and zero-payout cases', () => {
    expect(calculateIkzeEntry({
      id: 'complete',
      year: 2026,
      ownerName: 'Jakub',
      role: 'entrepreneur',
      annualLimit: 1000,
      contributedAmount: 1000,
      payoutsLeft: 4,
    }).status).toBe('complete')

    expect(calculateIkzeEntry({
      id: 'over',
      year: 2026,
      ownerName: 'Zona',
      role: 'employee',
      annualLimit: 1000,
      contributedAmount: 1200,
      payoutsLeft: 4,
    }).status).toBe('over_limit')

    const zeroPayouts = calculateIkzeEntry({
      id: 'zero',
      year: 2026,
      ownerName: 'Jakub',
      role: 'entrepreneur',
      annualLimit: 1000,
      contributedAmount: 250,
      payoutsLeft: 0,
    })
    expect(zeroPayouts.remaining).toBe(750)
    expect(zeroPayouts.perPayout).toBe(750)
  })

  it('summarizes family limit, contributions, remaining amount, and combined per-payout amount', () => {
    const entries: IkzePlanEntry[] = [
      { id: 'jakub', year: 2026, ownerName: 'Jakub', role: 'entrepreneur', annualLimit: 1000, contributedAmount: 100, payoutsLeft: 3 },
      { id: 'zona', year: 2026, ownerName: 'Zona', role: 'employee', annualLimit: 2000, contributedAmount: 500, payoutsLeft: 6 },
    ]

    const summary = summarizeIkzePlans(entries)

    expect(summary.annualLimit).toBe(3000)
    expect(summary.contributedAmount).toBe(600)
    expect(summary.remaining).toBe(2400)
    expect(summary.perPayout).toBe(550)
  })

  it('builds default plans for Jakub and wife using payouts left to December', () => {
    expect(payoutsLeftToYearEnd('2026-06')).toBe(7)

    const defaults = buildDefaultIkzePlans('2026-06')

    expect(defaults).toMatchObject([
      { id: 'ikze-jakub-2026', ownerName: 'Jakub', role: 'entrepreneur', year: 2026, annualLimit: 0, contributedAmount: 0, payoutsLeft: 7 },
      { id: 'ikze-zona-2026', ownerName: 'Zona', role: 'employee', year: 2026, annualLimit: 0, contributedAmount: 0, payoutsLeft: 7 },
    ])
  })

  it('returns combined recommended IKZE monthly contribution only when enabled in settings', () => {
    const entries: IkzePlanEntry[] = [
      { id: 'jakub', year: 2026, ownerName: 'Jakub', role: 'entrepreneur', annualLimit: 1200, contributedAmount: 0, payoutsLeft: 3 },
      { id: 'zona', year: 2026, ownerName: 'Zona', role: 'employee', annualLimit: 600, contributedAmount: 0, payoutsLeft: 6 },
    ]

    expect(ikzeMonthlyContributionCost({ ikzePlans: entries, includeIkzeContributionsInCashflow: false })).toBe(0)
    expect(ikzeMonthlyContributionCost({ ikzePlans: entries, includeIkzeContributionsInCashflow: true })).toBe(500)
  })
})
