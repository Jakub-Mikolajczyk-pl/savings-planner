import type {
  Goal,
  Loan,
  MonthlyActuals,
  MortgagePlan,
  Overrides,
  Settings,
  Subscription,
  UpcomingExpense,
} from './types'
import { buildSchedule } from './allocation'
import { currentYearMonth, formatYearMonth, monthDiff } from './formatting'

/*
 * Plan vs wykonanie.
 *
 * Plan: ten sam silnik co harmonogram (buildSchedule), tylko wystartowany od
 * najstarszego miesiąca z transakcjami — więc nadpisania (overrides), abonamenty,
 * raty i składki emerytalne liczą się identycznie jak w zakładce Plan.
 * Wykonanie: agregaty z transakcji bankowych (backend /reconciliation/monthly).
 */

export type DriftLevel = 'ok' | 'warn' | 'alert'

export interface ReconciliationMetric {
  planned: number
  actual: number
  driftPct?: number // (actual - planned) / planned * 100
  level: DriftLevel
}

export interface ReconciliationRow {
  yearMonth: string
  label: string
  isPartial: boolean // bieżący, niedomknięty miesiąc
  income: ReconciliationMetric
  expenses: ReconciliationMetric
  savings: ReconciliationMetric
  uncategorizedCount: number
  transactionCount: number
}

/** Dla wydatków przekroczenie planu jest złe; dla przychodów i oszczędzania złe jest niedowiezienie. */
function driftLevel(driftPct: number | undefined, badWhenAbove: boolean): DriftLevel {
  if (driftPct === undefined) return 'ok'
  const bad = badWhenAbove ? driftPct : -driftPct
  if (bad <= 10) return 'ok'
  if (bad <= 25) return 'warn'
  return 'alert'
}

function metric(planned: number, actual: number, badWhenAbove: boolean): ReconciliationMetric {
  const driftPct = planned > 0
    ? Math.round(((actual - planned) / planned) * 1000) / 10
    : undefined
  return { planned, actual, driftPct, level: driftLevel(driftPct, badWhenAbove) }
}

export function buildReconciliationRows(
  settings: Settings,
  goals: Goal[],
  loans: Loan[],
  overrides: Overrides,
  mortgagePlan: MortgagePlan | undefined,
  subscriptions: Subscription[],
  upcomingExpenses: UpcomingExpense[],
  actuals: MonthlyActuals[],
): ReconciliationRow[] {
  if (actuals.length === 0) return []

  const sorted = [...actuals].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
  const first = sorted[0].yearMonth
  const last = sorted[sorted.length - 1].yearMonth
  const span = Math.max(1, monthDiff(first, last) + 1)

  const schedule = buildSchedule(
    { ...settings, startMonth: first, horizonMonths: Math.min(span, 120) },
    goals,
    loans,
    overrides,
    0,
    0,
    mortgagePlan,
    subscriptions,
    upcomingExpenses,
  )
  const plannedByMonth = new Map(schedule.rows.map(row => [row.yearMonth, row]))
  const thisMonth = currentYearMonth()

  return sorted.map(actual => {
    const planned = plannedByMonth.get(actual.yearMonth)
    const plannedIncome = planned?.income ?? settings.monthlyIncome
    // Wydatki z banku zawierają wszystko poza oszczędnościami/transferami,
    // więc po stronie planu sumujemy życie + abonamenty + jednorazowe + raty.
    const plannedExpenses = planned
      ? planned.expenses + planned.subscriptionsTotal + planned.oneTimeExpensesTotal
        + planned.loanPaymentsTotal + planned.mortgagePaymentTotal
      : settings.monthlyExpenses
    // Plan oszczędzania = alokacje na cele + składki emerytalne wliczane w cashflow.
    const plannedSavings = planned
      ? planned.goalAllocations.reduce((sum, allocation) => sum + allocation.allocated, 0)
        + planned.ikzeContributionTotal + (planned.ikeContributionTotal ?? 0) + (planned.ppkContributionTotal ?? 0)
      : 0

    return {
      yearMonth: actual.yearMonth,
      label: formatYearMonth(actual.yearMonth),
      isPartial: actual.yearMonth === thisMonth,
      income: metric(plannedIncome, actual.income, false),
      expenses: metric(plannedExpenses, actual.expense, true),
      savings: metric(plannedSavings, Math.max(0, actual.savingsContribution - actual.savingsWithdrawal), false),
      uncategorizedCount: actual.uncategorizedCount,
      transactionCount: actual.transactionCount,
    }
  })
}
