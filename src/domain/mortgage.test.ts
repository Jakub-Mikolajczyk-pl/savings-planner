import { describe, expect, it } from 'vitest'
import { buildMortgageSchedule, calculateMortgagePayment } from './mortgage'
import type { MortgagePlan } from './types'

const basePlan: MortgagePlan = {
  id: 'm1',
  name: 'Hipoteka',
  principal: 500000,
  annualInterestRate: 6,
  originalTermMonths: 360,
  termMonths: 300,
  monthlyOverpayment: 0,
  overpaymentMode: 'shortenTerm',
  oneTimeOverpayments: [],
}

describe('mortgage schedule', () => {
  it('calculates a fixed-rate annuity payment', () => {
    expect(calculateMortgagePayment(500000, 0.06 / 12, 300)).toBeCloseTo(3221.51, 2)
  })

  it('splits the first payment into interest and principal', () => {
    const { entries } = buildMortgageSchedule(basePlan, '2026-01', 1)

    expect(entries[0].interest).toBe(2500)
    expect(entries[0].principalPaid).toBeCloseTo(497.75, 2)
    expect(entries[0].balanceAfter).toBeCloseTo(499502.25, 2)
  })

  it('uses only the original term for base payment and keeps remaining term as timeline context', () => {
    const { summary } = buildMortgageSchedule(
      { ...basePlan, principal: 500000, originalTermMonths: 360, termMonths: 348 },
      '2026-01',
      36,
      true,
    )
    const rate = 0.06 / 12

    expect(summary?.originalTermMonths).toBe(360)
    expect(summary?.remainingMonths).toBe(348)
    expect(summary?.elapsedMonths).toBe(12)
    expect(summary?.estimatedStartMonth).toBe('2025-01')
    expect(summary?.baseMonthlyPayment).toBeCloseTo(calculateMortgagePayment(500000, rate, 360), 2)
  })

  it('does not change base payment when only remaining term changes', () => {
    const { summary: longerRemaining } = buildMortgageSchedule(
      { ...basePlan, principal: 500000, originalTermMonths: 360, termMonths: 348 },
      '2026-01',
      36,
      true,
    )
    const { summary: shorterRemaining } = buildMortgageSchedule(
      { ...basePlan, principal: 500000, originalTermMonths: 360, termMonths: 240 },
      '2026-01',
      36,
      true,
    )

    expect(shorterRemaining?.elapsedMonths).toBe(120)
    expect(shorterRemaining?.estimatedStartMonth).toBe('2016-01')
    expect(shorterRemaining?.baseMonthlyPayment).toBe(longerRemaining?.baseMonthlyPayment)
  })

  it('shows refinancing savings for a lower interest rate', () => {
    const { summary } = buildMortgageSchedule(
      {
        ...basePlan,
        refinanceAnnualInterestRate: 4.5,
        refinanceCost: 5000,
      },
      '2026-01',
      360,
      true,
    )

    expect(summary?.refinance?.monthlyPayment).toBeLessThan(summary?.baseMonthlyPayment ?? 0)
    expect(summary?.refinance?.interestSaved).toBeGreaterThan(0)
    expect(summary?.refinance?.netSavings).toBeCloseTo((summary?.refinance?.interestSaved ?? 0) - 5000, 2)
  })

  it('can return the full payoff schedule beyond the planner horizon', () => {
    const { entries, summary } = buildMortgageSchedule(basePlan, '2026-01', 36, true)

    expect(entries.length).toBeGreaterThan(36)
    expect(entries.at(-1)?.isPaidOff).toBe(true)
    expect(entries.at(-1)?.yearMonth).toBe(summary?.payoffMonth)
  })

  it('shortens the term and saves interest with monthly overpayments', () => {
    const { summary } = buildMortgageSchedule(
      { ...basePlan, monthlyOverpayment: 1000, overpaymentMode: 'shortenTerm' },
      '2026-01',
      360,
    )

    expect(summary?.monthsSaved).toBeGreaterThan(0)
    expect(summary?.interestSaved).toBeGreaterThan(0)
  })

  it('reduces the next scheduled payment after a one-time overpayment', () => {
    const { entries } = buildMortgageSchedule(
      {
        ...basePlan,
        overpaymentMode: 'reducePayment',
        oneTimeOverpayments: [{ id: 'o1', yearMonth: '2026-01', amount: 50000 }],
      },
      '2026-01',
      3,
    )

    expect(entries[0].overpayment).toBe(50000)
    expect(entries[1].payment).toBeLessThan(entries[0].payment)
  })
})
