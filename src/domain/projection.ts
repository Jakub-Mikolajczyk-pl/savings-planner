import type { Goal, GoalInsights, Loan, Schedule } from './types'
import type { SecurityBuffer } from './securityBuffers'
import { monthDiff } from './formatting'

export type ProjectionPerspective = 'goals' | 'debts' | 'all'

export interface ProjectionGoalItem {
  id: string
  goalId: string
  name: string
  kind: 'manual' | 'security'
  current: number
  target: number
  remaining: number
  eta?: string
  status?: string
  plannedPerCycle?: number
  actualPerCycle?: number
  whatIfEtaDeltaMonths?: number
  priority?: number
  detail?: string
  focusCopy?: string
  series?: number[]
  whatIfSeries?: number[]
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
  securityBuffers?: SecurityBuffer[]
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
  securityBuffers = [],
  hasWhatIf,
}: ProjectionDashboardInput): ProjectionDashboardModel {
  const insightByGoalId = new Map(goalInsights?.goals.map(goal => [goal.goalId, goal]))
  const securityGoalItems = securityBuffers
    .filter(buffer => buffer.status === 'missing')
    .map(buffer => {
      const series = buildSecuritySeries(buffer.current, buffer.target, schedule)
      const whatIfSeries = buildSecuritySeries(buffer.current, buffer.target, whatIfSchedule)
      const eta = seriesEta(series, schedule, buffer.target)
      const whatIfEta = seriesEta(whatIfSeries, whatIfSchedule, buffer.target)

      return {
        id: `goal:${buffer.goalId}`,
        goalId: buffer.goalId,
        name: buffer.title,
        kind: 'security' as const,
        current: buffer.current,
        target: buffer.target,
        remaining: buffer.missing,
        eta,
        status: 'security_priority',
        plannedPerCycle: firstPositiveFreeCash(schedule),
        whatIfEtaDeltaMonths: hasWhatIf ? etaDelta(eta, whatIfEta) : undefined,
        priority: buffer.priority,
        detail: buffer.detail,
        focusCopy: buffer.focusCopy,
        series,
        whatIfSeries,
      }
    })
  const goalItems = goals
    .map(goal => {
      const insight = insightByGoalId.get(goal.id)
      const current = goal.currentSaved ?? 0
      const eta = goalEta(schedule, goal.id)
      const whatIfEta = goalEta(whatIfSchedule, goal.id)

      return {
        id: `goal:${goal.id}`,
        goalId: goal.id,
        name: goal.name,
        kind: 'manual' as const,
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
  const allGoalItems = [...securityGoalItems, ...goalItems]

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

  const atRiskGoal = allGoalItems.find(goal => goal.kind === 'security')
    ?? allGoalItems.find(goal => goal.status === 'unreachable' || goal.status === 'behind_plan')
  const latestDebt = [...debtItems].sort((a, b) =>
    (b.eta ?? '0000-00').localeCompare(a.eta ?? '0000-00') || b.monthlyPayment - a.monthlyPayment
  )[0]
  const defaultPerspective: ProjectionPerspective = allGoalItems.length > 0 ? 'goals' : debtItems.length > 0 ? 'debts' : 'all'

  return {
    goals: allGoalItems,
    debts: debtItems,
    defaultPerspective,
    defaultSelectedId: defaultPerspective === 'goals' ? (atRiskGoal ?? allGoalItems[0])?.id : latestDebt?.id,
  }
}

function buildSecuritySeries(current: number, target: number, schedule: Schedule): number[] {
  let balance = current
  return schedule.rows.map(row => {
    if (balance < target) {
      balance = Math.min(target, balance + Math.max(0, row.freeCash))
    }
    return balance
  })
}

function seriesEta(series: number[], schedule: Schedule, target: number) {
  const index = series.findIndex(value => value >= target)
  if (index >= 0) return schedule.rows[index]?.yearMonth
  return undefined
}

function firstPositiveFreeCash(schedule: Schedule) {
  return schedule.rows.find(row => row.freeCash > 0)?.freeCash
}
