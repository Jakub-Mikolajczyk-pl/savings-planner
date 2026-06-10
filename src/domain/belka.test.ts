import { describe, expect, it } from 'vitest'
import { BELKA_TAX_RATE, projectMonthlyInvestment } from './belka'

describe('projectMonthlyInvestment', () => {
  it('without returns there are no gains and no tax', () => {
    const result = projectMonthlyInvestment(1000, 10, 0, BELKA_TAX_RATE)
    expect(result.contributed).toBe(120000)
    expect(result.finalValue).toBe(120000)
    expect(result.gains).toBe(0)
    expect(result.taxPaid).toBe(0)
    expect(result.netValue).toBe(120000)
  })

  it('taxes 19% of gains only', () => {
    const result = projectMonthlyInvestment(1000, 10, 6, BELKA_TAX_RATE)
    expect(result.gains).toBeGreaterThan(0)
    expect(result.taxPaid).toBeCloseTo(result.gains * 0.19, 1)
    expect(result.netValue).toBeCloseTo(result.finalValue - result.taxPaid, 2)
  })

  it('tax-sheltered variant keeps the full final value', () => {
    const sheltered = projectMonthlyInvestment(1000, 10, 6, 0)
    const taxable = projectMonthlyInvestment(1000, 10, 6, BELKA_TAX_RATE)
    expect(sheltered.netValue).toBeGreaterThan(taxable.netValue)
    expect(sheltered.taxPaid).toBe(0)
  })
})
