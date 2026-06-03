import { describe, expect, it } from 'vitest'
import { buildSchedule } from './allocation'
import { buildProjectionDashboardModel } from './projection'
import type { Goal, GoalInsights, Loan, Settings } from './types'

const settings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: '2026-01',
  horizonMonths: 12,
  emergencyFundBuckets: ['safety_cushion'],
}

const goals: Goal[] = [
  {
    id: 'holiday',
    name: 'Wakacje',
    targetAmount: 12000,
    currentSaved: 0,
    priority: 1,
    fixedAllocation: 500,
    deadline: '2026-03-01',
  },
  {
    id: 'renovation',
    name: 'Remont',
    targetAmount: 24000,
    currentSaved: 6000,
    priority: 2,
  },
]

const loans: Loan[] = [
  { id: 'card', name: 'Karta', remainingBalance: 3000, monthlyPayment: 500 },
  { id: 'car', name: 'Auto', remainingBalance: 18000, monthlyPayment: 900 },
]

const insights: GoalInsights = {
  cycleCount: 4,
  recentCycles: [],
  averageNetPerCycle: 2500,
  averageFreeCashPerCycle: 2200,
  goals: [
    {
      goalId: 'holiday',
      name: 'Wakacje',
      targetAmount: 12000,
      currentSaved: 0,
      remainingAmount: 12000,
      priority: 1,
      fixedAllocation: 500,
      plannedPerCycle: 500,
      actualPerCycle: 150,
      status: 'behind_plan',
    },
    {
      goalId: 'renovation',
      name: 'Remont',
      targetAmount: 24000,
      currentSaved: 6000,
      remainingAmount: 18000,
      priority: 2,
      fixedAllocation: 1000,
      plannedPerCycle: 1000,
      actualPerCycle: 1200,
      status: 'on_track',
    },
  ],
}

describe('projection dashboard model', () => {
  it('defaults to goals and selects the first at-risk goal', () => {
    const schedule = buildSchedule(settings, goals, loans, {})
    const whatIfSchedule = buildSchedule(settings, goals, loans, {}, 1000, 300)

    const model = buildProjectionDashboardModel({
      schedule,
      whatIfSchedule,
      goals,
      loans,
      goalInsights: insights,
      hasWhatIf: true,
    })

    expect(model.defaultPerspective).toBe('goals')
    expect(model.defaultSelectedId).toBe('goal:holiday')
    expect(model.goals[0]).toMatchObject({
      id: 'goal:holiday',
      name: 'Wakacje',
      status: 'behind_plan',
      plannedPerCycle: 500,
      actualPerCycle: 150,
    })
    expect(model.goals[0].whatIfEtaDeltaMonths).toBeLessThanOrEqual(0)
  })

  it('uses debt perspective when there are no goals and selects the latest payoff debt', () => {
    const schedule = buildSchedule(settings, [], loans, {})
    const whatIfSchedule = buildSchedule(settings, [], loans, {}, 0, 300)

    const model = buildProjectionDashboardModel({
      schedule,
      whatIfSchedule,
      goals: [],
      loans,
      hasWhatIf: true,
    })

    expect(model.defaultPerspective).toBe('debts')
    expect(model.defaultSelectedId).toBe('debt:car')
    expect(model.debts[0].id).toBe('debt:card')
    expect(model.debts[1]).toMatchObject({
      id: 'debt:car',
      name: 'Auto',
      balance: 18000,
      monthlyPayment: 900,
    })
    expect(model.debts[1].whatIfPayoffDeltaMonths).toBeGreaterThanOrEqual(0)
  })

  it('keeps goals that complete within the horizon in the decision list', () => {
    const quickGoal: Goal = {
      id: 'quick',
      name: 'Szybki cel',
      targetAmount: 4000,
      currentSaved: 0,
      priority: 1,
    }
    const schedule = buildSchedule(settings, [quickGoal], [], {})
    const model = buildProjectionDashboardModel({
      schedule,
      whatIfSchedule: schedule,
      goals: [quickGoal],
      loans: [],
      hasWhatIf: false,
    })

    expect(schedule.goalProgress[0].isComplete).toBe(true)
    expect(model.goals).toHaveLength(1)
    expect(model.goals[0]).toMatchObject({
      id: 'goal:quick',
      current: 0,
      remaining: 4000,
      eta: '2026-01',
    })
  })
})
