import { describe, expect, it } from 'vitest'
import { buildSchedule } from './allocation'
import type { Goal, Loan, Settings, Subscription, UpcomingExpense } from './types'

const baseSettings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: '2026-01',
  horizonMonths: 6,
  emergencyFundBuckets: ['cash', 'investment'],
}

const goals: Goal[] = [
  { id: 'g1', name: 'Poduszka', targetAmount: 12000, priority: 1 },
]

const noLoans: Loan[] = []

describe('buildSchedule - subscriptions and upcoming expenses', () => {
  it('subtracts active subscriptions from free cash every month', () => {
    const subscriptions: Subscription[] = [
      { id: 's1', name: 'Netflix', monthlyAmount: 60, active: true },
      { id: 's2', name: 'Silownia', monthlyAmount: 140, active: true },
      { id: 's3', name: 'Pauza', monthlyAmount: 500, active: false },
    ]

    const { rows } = buildSchedule(baseSettings, goals, noLoans, {}, 0, 0, undefined, subscriptions)

    expect(rows[0].expenses).toBe(6000)
    expect(rows[0].subscriptionsTotal).toBe(200)
    expect(rows[0].oneTimeExpensesTotal).toBe(0)
    expect(rows[0].freeCash).toBe(3800)
    expect(rows[1].freeCash).toBe(3800)
  })

  it('subtracts an unpaid one-time expense only in target month', () => {
    const upcomingExpenses: UpcomingExpense[] = [
      { id: 'e1', name: 'OC auta', amount: 1200, targetMonth: '2026-02', isPaid: false },
      { id: 'e2', name: 'Oplacone', amount: 800, targetMonth: '2026-02', isPaid: true },
    ]

    const { rows } = buildSchedule(baseSettings, goals, noLoans, {}, 0, 0, undefined, [], upcomingExpenses)

    expect(rows[0].oneTimeExpensesTotal).toBe(0)
    expect(rows[0].freeCash).toBe(4000)
    expect(rows[1].oneTimeExpensesTotal).toBe(1200)
    expect(rows[1].freeCash).toBe(2800)
    expect(rows[2].oneTimeExpensesTotal).toBe(0)
    expect(rows[2].freeCash).toBe(4000)
  })

  it('ignores inactive subscriptions and paid upcoming expenses', () => {
    const subscriptions: Subscription[] = [
      { id: 's1', name: 'Nieaktywny', monthlyAmount: 300, active: false },
    ]
    const upcomingExpenses: UpcomingExpense[] = [
      { id: 'e1', name: 'Oplacony', amount: 700, targetMonth: '2026-01', isPaid: true },
    ]

    const { rows } = buildSchedule(baseSettings, goals, noLoans, {}, 0, 0, undefined, subscriptions, upcomingExpenses)

    expect(rows[0].subscriptionsTotal).toBe(0)
    expect(rows[0].oneTimeExpensesTotal).toBe(0)
    expect(rows[0].freeCash).toBe(4000)
  })
})
