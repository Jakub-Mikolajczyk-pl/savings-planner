import { describe, expect, it } from 'vitest'
import { buildDefaultIkePlans, calculateIkeEntry, IKE_LIMITS, ikeMonthlyContributionCost, projectIkeTaxFreeBenefit, summarizeIkePlans } from './ike'
import type { IkePlanEntry } from './types'

const entry = (patch: Partial<IkePlanEntry> = {}): IkePlanEntry => ({
  id: 'ike-1',
  year: 2026,
  ownerName: 'Jakub',
  annualLimit: 27621,
  contributedAmount: 0,
  payoutsLeft: 12,
  ...patch,
})

describe('calculateIkeEntry', () => {
  it('splits the remaining limit across payouts', () => {
    const result = calculateIkeEntry(entry({ contributedAmount: 7621, payoutsLeft: 10 }))
    expect(result.remaining).toBe(20000)
    expect(result.perPayout).toBe(2000)
    expect(result.status).toBe('in_progress')
  })

  it('flags missing limit and over-limit states', () => {
    expect(calculateIkeEntry(entry({ annualLimit: 0 })).status).toBe('missing_limit')
    expect(calculateIkeEntry(entry({ contributedAmount: 30000 })).status).toBe('over_limit')
    expect(calculateIkeEntry(entry({ contributedAmount: 27621 })).status).toBe('complete')
  })
})

describe('summarizeIkePlans / cashflow cost', () => {
  const plans = [entry(), entry({ id: 'ike-2', ownerName: 'Zona', contributedAmount: 1621 })]

  it('sums family plans', () => {
    const summary = summarizeIkePlans(plans)
    expect(summary.annualLimit).toBe(55242)
    expect(summary.contributedAmount).toBe(1621)
  })

  it('costs nothing in cashflow unless the toggle is on', () => {
    expect(ikeMonthlyContributionCost({ ikePlans: plans, includeIkeContributionsInCashflow: false })).toBe(0)
    expect(ikeMonthlyContributionCost({ ikePlans: plans, includeIkeContributionsInCashflow: true }))
      .toBe(summarizeIkePlans(plans).perPayout)
  })
})

describe('buildDefaultIkePlans', () => {
  it('uses the standard limit for the plan year', () => {
    const plans = buildDefaultIkePlans('2026-03')
    expect(plans).toHaveLength(2)
    expect(plans[0].annualLimit).toBe(IKE_LIMITS[2026])
    expect(plans[0].payoutsLeft).toBe(10)
  })
})

describe('projectIkeTaxFreeBenefit', () => {
  it('grows with horizon and is zero without returns', () => {
    expect(projectIkeTaxFreeBenefit(1000, 10, 0)).toBe(0)
    const short = projectIkeTaxFreeBenefit(1000, 5, 5)
    const long = projectIkeTaxFreeBenefit(1000, 20, 5)
    expect(short).toBeGreaterThan(0)
    expect(long).toBeGreaterThan(short)
  })
})
