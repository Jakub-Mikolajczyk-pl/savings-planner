import { describe, it, expect } from 'vitest'
import { buildSchedule } from './allocation'
import type { Goal, Settings, Overrides, Loan } from './types'

const baseSettings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: '2026-01',
  horizonMonths: 24,
  emergencyFundBuckets: ['safety_cushion'],
}

const makeGoal = (overrides: Partial<Goal> & { id: string; name: string; targetAmount: number }): Goal => ({
  priority: 1,
  ...overrides,
})

const noLoans: Loan[] = []

describe('buildSchedule — basic allocation', () => {
  it('reaches a single goal within expected months', () => {
    const goals: Goal[] = [makeGoal({ id: 'g1', name: 'Wakacje', targetAmount: 8000, priority: 1 })]
    const { rows, goalProgress } = buildSchedule(baseSettings, goals, noLoans, {})

    // freeCash = 4000/m, need 8000 → should complete month 2
    expect(goalProgress[0].completionMonth).toBe('2026-02')
    expect(goalProgress[0].isComplete).toBe(true)

    // Month 1: allocates 4000
    expect(rows[0].goalAllocations[0].allocated).toBe(4000)
    expect(rows[0].goalAllocations[0].balanceAfter).toBe(4000)

    // Month 2: allocates remaining 4000
    expect(rows[1].goalAllocations[0].allocated).toBe(4000)
    expect(rows[1].goalAllocations[0].balanceAfter).toBe(8000)
    expect(rows[1].goalAllocations[0].isComplete).toBe(true)
  })

  it('marks deficit months correctly', () => {
    const goals: Goal[] = [makeGoal({ id: 'g1', name: 'Test', targetAmount: 5000, priority: 1 })]
    const overrides: Overrides = { '2026-03': { income: 3000, expenses: 5000 } }
    const { rows } = buildSchedule(baseSettings, goals, noLoans, overrides)

    const deficitRow = rows.find(r => r.yearMonth === '2026-03')!
    expect(deficitRow.isDeficit).toBe(true)
    expect(deficitRow.freeCash).toBe(-2000)
    expect(deficitRow.goalAllocations[0].allocated).toBe(0)
  })

  it('prioritizes goal with closer deadline (urgency)', () => {
    const goals: Goal[] = [
      makeGoal({ id: 'g1', name: 'Spokojny', targetAmount: 10000, priority: 1 }),
      makeGoal({ id: 'g2', name: 'Pilny', targetAmount: 4000, priority: 2, deadline: '2026-03-01' }),
    ]
    const { rows } = buildSchedule(baseSettings, goals, noLoans, {})

    // g2 has closer deadline → should get more allocation in month 1 despite lower priority number of g1
    const month1 = rows[0]
    const g1alloc = month1.goalAllocations.find(a => a.goalId === 'g1')!
    const g2alloc = month1.goalAllocations.find(a => a.goalId === 'g2')!
    expect(g2alloc.allocated).toBeGreaterThan(g1alloc.allocated)
  })

  it('respects fixed allocation and gives remainder to other goals', () => {
    const goals: Goal[] = [
      makeGoal({ id: 'g1', name: 'Fixed', targetAmount: 20000, priority: 1, fixedAllocation: 1000 }),
      makeGoal({ id: 'g2', name: 'Flex', targetAmount: 5000, priority: 2 }),
    ]
    const { rows } = buildSchedule(baseSettings, goals, noLoans, {})

    // free = 4000, fixed g1 = 1000, flex g2 gets up to 3000
    const month1 = rows[0]
    const g1 = month1.goalAllocations.find(a => a.goalId === 'g1')!
    const g2 = month1.goalAllocations.find(a => a.goalId === 'g2')!
    expect(g1.allocated).toBe(1000)
    expect(g2.allocated).toBe(3000)
  })

  it('what-if delta shifts completion month earlier', () => {
    const goals: Goal[] = [makeGoal({ id: 'g1', name: 'Dom', targetAmount: 24000, priority: 1 })]

    const { goalProgress: base } = buildSchedule(baseSettings, goals, noLoans, {})
    const { goalProgress: boosted } = buildSchedule(baseSettings, goals, noLoans, {}, 2000)

    // base: 4000/m → 6 months; boosted: 6000/m → 4 months
    expect(base[0].completionMonth).toBe('2026-06')
    expect(boosted[0].completionMonth).toBe('2026-04')
  })

  it('detects missed deadline', () => {
    const goals: Goal[] = [
      makeGoal({ id: 'g1', name: 'Niemożliwe', targetAmount: 1000000, priority: 1, deadline: '2026-06-01' }),
    ]
    const { goalProgress } = buildSchedule(baseSettings, goals, noLoans, {})
    expect(goalProgress[0].deadlineMissed).toBe(true)
  })

  it('carries overflow to next goal after completion', () => {
    const goals: Goal[] = [
      makeGoal({ id: 'g1', name: 'Mały', targetAmount: 1000, priority: 1 }),
      makeGoal({ id: 'g2', name: 'Duży', targetAmount: 20000, priority: 2 }),
    ]
    const { rows } = buildSchedule(baseSettings, goals, noLoans, {})

    // month 1: g1 needs only 1000, rest (3000) should flow to g2
    const m1g2 = rows[0].goalAllocations.find(a => a.goalId === 'g2')!
    expect(m1g2.allocated).toBe(3000)
  })
})
