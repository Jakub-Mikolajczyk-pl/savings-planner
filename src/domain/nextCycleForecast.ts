import { buildSchedule } from './allocation'
import { creditCardStatus } from './creditCard'
import type {
  Goal,
  Loan,
  MortgagePlan,
  Overrides,
  Settings,
  Subscription,
  UpcomingExpense,
} from './types'

export type NextCycleForecastLineKey =
  | 'living'
  | 'subscriptions'
  | 'oneTime'
  | 'debt'
  | 'ikze'
  | 'creditCard'

export interface NextCycleForecastLine {
  key: NextCycleForecastLineKey
  label: string
  amount: number
  detail?: string
}

export interface NextCycleForecast {
  currentMonth: string
  targetMonth: string
  income: number
  totalRequired: number
  freeCashBeforeCreditCard: number
  freeCashAfterCreditCard: number
  creditCardPayment: number
  repaymentDayOfMonth?: number
  lines: NextCycleForecastLine[]
}

export function buildNextCycleForecast(
  settings: Settings,
  goals: Goal[],
  loans: Loan[],
  overrides: Overrides,
  mortgagePlan?: MortgagePlan,
  subscriptions: Subscription[] = [],
  upcomingExpenses: UpcomingExpense[] = [],
): NextCycleForecast {
  const schedule = buildSchedule(
    { ...settings, horizonMonths: Math.max(2, settings.horizonMonths) },
    goals,
    loans,
    overrides,
    0,
    0,
    mortgagePlan,
    subscriptions,
    upcomingExpenses,
  )
  const currentRow = schedule.rows[0]
  const targetRow = schedule.rows[1] ?? currentRow
  const cardStatus = settings.creditCard ? creditCardStatus(settings.creditCard) : undefined
  const creditCardPayment = cardStatus?.used ?? 0
  const debtTotal = targetRow.loanPaymentsTotal + targetRow.mortgagePaymentTotal
  const lines: NextCycleForecastLine[] = [
    { key: 'living', label: 'Koszty życia', amount: targetRow.expenses },
    { key: 'subscriptions', label: 'Abonamenty', amount: targetRow.subscriptionsTotal },
    { key: 'oneTime', label: 'Jednorazowe', amount: targetRow.oneTimeExpensesTotal },
    { key: 'debt', label: 'Raty i hipoteka', amount: debtTotal },
    { key: 'ikze', label: 'IKZE', amount: targetRow.ikzeContributionTotal },
    {
      key: 'creditCard',
      label: 'Spłata karty',
      amount: creditCardPayment,
      detail: settings.creditCard?.repaymentDayOfMonth
        ? `${settings.creditCard.repaymentDayOfMonth}. dzień miesiąca`
        : settings.creditCard
          ? 'dzień spłaty nieustawiony'
          : 'brak skonfigurowanej karty',
    },
  ]
  const totalRequired = lines.reduce((sum, line) => sum + line.amount, 0)

  return {
    currentMonth: currentRow.yearMonth,
    targetMonth: targetRow.yearMonth,
    income: targetRow.income,
    totalRequired,
    freeCashBeforeCreditCard: targetRow.freeCash,
    freeCashAfterCreditCard: targetRow.freeCash - creditCardPayment,
    creditCardPayment,
    repaymentDayOfMonth: settings.creditCard?.repaymentDayOfMonth,
    lines,
  }
}
