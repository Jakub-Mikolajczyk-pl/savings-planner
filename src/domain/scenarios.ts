import type {
  Goal,
  Loan,
  MortgagePlan,
  Overrides,
  PlanScenario,
  Schedule,
  Settings,
  Subscription,
  UpcomingExpense,
} from './types'
import { buildSchedule } from './allocation'
import { monthDiff } from './formatting'

/*
 * Zapisane scenariusze what-if.
 *
 * Scenariusz = nazwane odchylenie (dochód/koszty/nadpłata kredytów) liczone tym
 * samym silnikiem co plan bazowy. Porównujemy: wolne środki, przesunięcia ETA
 * celów i spłat kredytów.
 */

export interface GoalShift {
  goalId: string
  name: string
  baselineEta?: string
  scenarioEta?: string
  monthsDelta?: number // ujemne = cel szybciej
}

export interface DebtShift {
  loanId: string
  name: string
  baselineEta?: string
  scenarioEta?: string
  monthsDelta?: number // ujemne = spłata szybciej
}

export interface ScenarioImpact {
  scenario: PlanScenario
  freeCashBaseline: number
  freeCashScenario: number
  goalShifts: GoalShift[]
  debtShifts: DebtShift[]
}

export interface ScenarioInputs {
  settings: Settings
  goals: Goal[]
  loans: Loan[]
  overrides: Overrides
  mortgagePlan?: MortgagePlan
  subscriptions: Subscription[]
  upcomingExpenses: UpcomingExpense[]
}

export function buildBaselineSchedule(inputs: ScenarioInputs): Schedule {
  return buildSchedule(
    inputs.settings,
    inputs.goals,
    inputs.loans,
    inputs.overrides,
    0,
    0,
    inputs.mortgagePlan,
    inputs.subscriptions,
    inputs.upcomingExpenses,
  )
}

const goalEta = (schedule: Schedule, goalId: string) => {
  const progress = schedule.goalProgress.find(goal => goal.goalId === goalId)
  return progress?.completionMonth ?? progress?.projectedETA
}

const loanEta = (schedule: Schedule, loanId: string) => {
  const progress = schedule.loanProgress.find(loan => loan.loanId === loanId)
  return progress?.payoffMonth ?? progress?.projectedPayoffMonth
}

export function compareScenario(
  scenario: PlanScenario,
  inputs: ScenarioInputs,
  baseline: Schedule,
): ScenarioImpact {
  // Silnik zna jedną deltę netto (whatIfDelta); wyższe koszty to po prostu ujemny dochód.
  const netDelta = scenario.incomeDelta - scenario.expensesDelta
  const scenarioSchedule = buildSchedule(
    inputs.settings,
    inputs.goals,
    inputs.loans,
    inputs.overrides,
    netDelta,
    Math.max(0, scenario.loanOverpayment),
    inputs.mortgagePlan,
    inputs.subscriptions,
    inputs.upcomingExpenses,
  )

  const goalShifts: GoalShift[] = inputs.goals
    .filter(goal => (goal.currentSaved ?? 0) < goal.targetAmount)
    .map(goal => {
      const baselineEta = goalEta(baseline, goal.id)
      const scenarioEta = goalEta(scenarioSchedule, goal.id)
      return {
        goalId: goal.id,
        name: goal.name,
        baselineEta,
        scenarioEta,
        monthsDelta: baselineEta && scenarioEta ? monthDiff(baselineEta, scenarioEta) : undefined,
      }
    })

  const debtShifts: DebtShift[] = inputs.loans
    .filter(loan => loan.remainingBalance > 0)
    .map(loan => {
      const baselineEta = loanEta(baseline, loan.id)
      const scenarioEta = loanEta(scenarioSchedule, loan.id)
      return {
        loanId: loan.id,
        name: loan.name,
        baselineEta,
        scenarioEta,
        monthsDelta: baselineEta && scenarioEta ? monthDiff(baselineEta, scenarioEta) : undefined,
      }
    })

  return {
    scenario,
    freeCashBaseline: baseline.rows[0]?.freeCash ?? 0,
    freeCashScenario: scenarioSchedule.rows[0]?.freeCash ?? 0,
    goalShifts,
    debtShifts,
  }
}
