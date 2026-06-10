import { describe, expect, it } from 'vitest'
import { fireBands, projectFire, type FireInputs } from './fire'

const inputs: FireInputs = {
  currentCapital: 100000,
  monthlyContribution: 3000,
  annualReturnPct: 4,
  targetMonthlySpending: 6000,
  withdrawalRatePct: 4,
}

describe('projectFire', () => {
  it('computes the 25x target for 4% SWR', () => {
    expect(projectFire(inputs).targetAmount).toBe(6000 * 12 * 25)
  })

  it('reaches the target in a finite, sane time', () => {
    const result = projectFire(inputs)
    expect(result.monthsToTarget).toBeDefined()
    // 1,8 mln z 100k + 3k/mc przy 4%: grubo ponad dekadę, mniej niż 50 lat
    expect(result.monthsToTarget!).toBeGreaterThan(120)
    expect(result.monthsToTarget!).toBeLessThan(600)
  })

  it('is immediate when capital already exceeds the target', () => {
    const result = projectFire({ ...inputs, currentCapital: 2_000_000 })
    expect(result.monthsToTarget).toBe(0)
  })

  it('is unreachable without contributions and returns', () => {
    const result = projectFire({ ...inputs, currentCapital: 1000, monthlyContribution: 0, annualReturnPct: 0 })
    expect(result.monthsToTarget).toBeUndefined()
  })

  it('bands order: optimistic <= base <= pessimistic', () => {
    const bands = fireBands(inputs)
    expect(bands.optimistic.monthsToTarget!).toBeLessThanOrEqual(bands.base.monthsToTarget!)
    expect(bands.base.monthsToTarget!).toBeLessThanOrEqual(bands.pessimistic.monthsToTarget ?? Infinity)
  })

  it('emits yearly series points', () => {
    const series = projectFire(inputs).series
    expect(series[0]).toEqual({ monthIndex: 0, value: 100000 })
    expect(series[1].monthIndex).toBe(12)
    expect(series[1].value).toBeGreaterThan(100000 + 36000 - 1)
  })
})
