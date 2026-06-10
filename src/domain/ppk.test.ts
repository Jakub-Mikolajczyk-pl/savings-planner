import { describe, expect, it } from 'vitest'
import { PPK_DEFAULTS, ppkMonthlyBreakdown, ppkMonthlyEmployeeCost, projectPpkBalance } from './ppk'
import type { PpkSettings } from './types'

const ppk = (patch: Partial<PpkSettings> = {}): PpkSettings => ({
  ...PPK_DEFAULTS,
  enabled: true,
  grossMonthlySalary: 10000,
  ...patch,
})

describe('ppkMonthlyBreakdown', () => {
  it('computes employee, employer and state parts', () => {
    const breakdown = ppkMonthlyBreakdown(ppk())
    expect(breakdown.employee).toBe(200)
    expect(breakdown.employer).toBe(150)
    expect(breakdown.state).toBe(20)
    expect(breakdown.total).toBe(370)
  })

  it('returns zeros when disabled or without salary', () => {
    expect(ppkMonthlyBreakdown(undefined).total).toBe(0)
    expect(ppkMonthlyBreakdown(ppk({ enabled: false })).total).toBe(0)
    expect(ppkMonthlyBreakdown(ppk({ grossMonthlySalary: 0 })).total).toBe(0)
  })
})

describe('ppkMonthlyEmployeeCost', () => {
  it('hits cashflow only with the toggle on', () => {
    expect(ppkMonthlyEmployeeCost({ ppk: ppk() })).toBe(0)
    expect(ppkMonthlyEmployeeCost({ ppk: ppk({ includeInCashflow: true }) })).toBe(200)
  })
})

describe('projectPpkBalance', () => {
  it('accumulates contributions plus growth', () => {
    const flat = projectPpkBalance(ppk(), 1, 0)
    expect(flat).toBe(370 * 12)
    const withGrowth = projectPpkBalance(ppk({ currentBalance: 10000 }), 10, 4)
    expect(withGrowth).toBeGreaterThan(10000 + 370 * 120)
  })
})
