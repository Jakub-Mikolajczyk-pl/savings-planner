import type { Goal, GoalInsights, Loan, Schedule } from './types'
import { monthDiff } from './formatting'

export type ProjectionPerspective = 'goals' | 'debts' | 'all'

export interface ProjectionGoalItem {
  id: string
  goalId: string
  name: string
  current: number
  target: number
  remaining: number
  eta?: string
  status?: string
  plannedPerCycle?: number
  actualPerCycle?: number
  whatIfEtaDeltaMonths?: number
}

export interface ProjectionDebtItem {
  id: string
  debtId: string
  name: string
  balance: number
  monthlyPayment: number
  eta?: string
  whatIfPayoffDeltaMonths?: number
}

export interface ProjectionDashboardModel {
  goals: ProjectionGoalItem[]
  debts: ProjectionDebtItem[]
  defaultPerspective: ProjectionPerspective
  defaultSelectedId?: string
}

interface ProjectionDashboardInput {
  schedule: Schedule
  whatIfSchedule: Schedule
  goals: Goal[]
  loans: Loan[]
  goalInsights?: GoalInsights
  hasWhatIf: boolean
}

const goalEta = (schedule: Schedule, goalId: string) => {
  const progress = schedule.goalProgress.find(goal => goal.goalId === goalId)
  return progress?.completionMonth ?? progress?.projectedETA
}

const debtEta = (schedule: Schedule, debtId: string) => {
  const progress = schedule.loanProgress.find(debt => debt.loanId === debtId)
  return progress?.payoffMonth ?? progress?.projectedPayoffMonth
}

const etaDelta = (base?: string, next?: string) => base && next ? monthDiff(base, next) : undefined

export function buildProjectionDashboardModel({
  schedule,
  whatIfSchedule,
  goals,
  loans,
  goalInsights,
  hasWhatIf,
}: ProjectionDashboardInput): ProjectionDashboardModel {
  const insightByGoalId = new Map(goalInsights?.goals.map(goal => [goal.goalId, goal]))
  const goalItems = goals
    .map(goal => {
      const progress = schedule.goalProgress.find(item => item.goalId === goal.id)
      const insight = insightByGoalId.get(goal.id)
      const current = progress?.currentBalance ?? goal.currentSaved ?? 0
      const eta = goalEta(schedule, goal.id)
      const whatIfEta = goalEta(whatIfSchedule, goal.id)

      return {
        id: `goal:${goal.id}`,
        goalId: goal.id,
        name: goal.name,
        current,
        target: goal.targetAmount,
        remaining: Math.max(goal.targetAmount - current, 0),
        eta,
        status: insight?.status,
        plannedPerCycle: insight?.plannedPerCycle ?? goal.fixedAllocation,
        actualPerCycle: insight?.actualPerCycle,
        whatIfEtaDeltaMonths: hasWhatIf ? etaDelta(eta, whatIfEta) : undefined,
      }
    })
    .filter(goal => goal.remaining > 0)
    .sort((a, b) => {
      const rank = (status?: string) => status === 'unreachable' ? 0 : status === 'behind_plan' ? 1 : 2
      return rank(a.status) - rank(b.status)
        || (a.eta ?? '9999-99').localeCompare(b.eta ?? '9999-99')
        || a.remaining - b.remaining
    })

  const debtItems = loans
    .map(loan => {
      const eta = debtEta(schedule, loan.id)
      const whatIfEta = debtEta(whatIfSchedule, loan.id)
      return {
        id: `debt:${loan.id}`,
        debtId: loan.id,
        name: loan.name,
        balance: loan.remainingBalance,
        monthlyPayment: loan.monthlyPayment,
        eta,
        whatIfPayoffDeltaMonths: hasWhatIf && eta && whatIfEta ? monthDiff(whatIfEta, eta) : undefined,
      }
    })
    .filter(debt => debt.balance > 0)
    .sort((a, b) => (a.eta ?? '9999-99').localeCompare(b.eta ?? '9999-99') || b.monthlyPayment - a.monthlyPayment)

  const atRiskGoal = goalItems.find(goal => goal.status === 'unreachable' || goal.status === 'behind_plan')
  const latestDebt = [...debtItems].sort((a, b) =>
    (b.eta ?? '0000-00').localeCompare(a.eta ?? '0000-00') || b.monthlyPayment - a.monthlyPayment
  )[0]
  const defaultPerspective: ProjectionPerspective = goalItems.length > 0 ? 'goals' : debtItems.length > 0 ? 'debts' : 'all'

  return {
    goals: goalItems,
    debts: debtItems,
    defaultPerspective,
    defaultSelectedId: defaultPerspective === 'goals' ? (atRiskGoal ?? goalItems[0])?.id : latestDebt?.id,
  }
}
