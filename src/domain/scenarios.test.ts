import { describe, expect, it } from 'vitest'
import { buildBaselineSchedule, compareScenario, type ScenarioInputs } from './scenarios'
import type { PlanScenario } from './types'

const inputs: ScenarioInputs = {
  settings: {
    monthlyIncome: 10000,
    monthlyExpenses: 6000,
    startMonth: '2026-06',
    horizonMonths: 36,
    emergencyFundBuckets: ['safety_cushion'],
  },
  goals: [
    { id: 'g1', name: 'Wakacje', targetAmount: 24000, priority: 1 },
  ],
  loans: [
    { id: 'l1', name: 'Raty RTV', remainingBalance: 12000, monthlyPayment: 1000 },
  ],
  overrides: {},
  mortgagePlan: undefined,
  subscriptions: [],
  upcomingExpenses: [],
}

const scenario = (patch: Partial<PlanScenario>): PlanScenario => ({
  id: 's1',
  name: 'Test',
  incomeDelta: 0,
  expensesDelta: 0,
  loanOverpayment: 0,
  ...patch,
})

describe('compareScenario', () => {
  const baseline = buildBaselineSchedule(inputs)

  it('a zero scenario matches the baseline', () => {
    const impact = compareScenario(scenario({}), inputs, baseline)
    expect(impact.freeCashScenario).toBe(impact.freeCashBaseline)
    expect(impact.goalShifts[0].monthsDelta).toBe(0)
  })

  it('higher costs delay goals and reduce free cash', () => {
    const impact = compareScenario(scenario({ expensesDelta: 1500 }), inputs, baseline)
    expect(impact.freeCashScenario).toBeLessThan(impact.freeCashBaseline)
    expect(impact.goalShifts[0].monthsDelta ?? 0).toBeGreaterThan(0)
  })

  it('a raise accelerates goals', () => {
    const impact = compareScenario(scenario({ incomeDelta: 2000 }), inputs, baseline)
    expect(impact.goalShifts[0].monthsDelta ?? 0).toBeLessThan(0)
  })

  it('loan overpayment shortens the debt payoff', () => {
    const impact = compareScenario(scenario({ loanOverpayment: 1000 }), inputs, baseline)
    expect(impact.debtShifts[0].monthsDelta ?? 0).toBeLessThan(0)
  })
})
