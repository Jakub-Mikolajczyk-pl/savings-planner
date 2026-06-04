import { describe, expect, it } from 'vitest'
import { buildNextCycleForecast } from './nextCycleForecast'
import type { Goal, Loan, Settings, Subscription, UpcomingExpense } from './types'

const goals: Goal[] = [
  { id: 'g1', name: 'Poduszka', targetAmount: 12000, priority: 1 },
]

describe('buildNextCycleForecast', () => {
  it('uses the next schedule cycle and adds the nearest credit card repayment', () => {
    const settings: Settings = {
      monthlyIncome: 10000,
      monthlyExpenses: 6000,
      startMonth: '2026-01',
      horizonMonths: 1,
      emergencyFundBuckets: ['safety_cushion'],
      creditCard: {
        name: 'Karta',
        limit: 10000,
        availableLimit: 6500,
        repaymentDayOfMonth: 5,
      },
    }
    const loans: Loan[] = [
      { id: 'l1', name: 'Rata', remainingBalance: 3000, monthlyPayment: 1000 },
    ]
    const subscriptions: Subscription[] = [
      { id: 's1', name: 'Siłownia', monthlyAmount: 200, active: true },
    ]
    const upcomingExpenses: UpcomingExpense[] = [
      { id: 'e1', name: 'OC auta', amount: 1200, targetMonth: '2026-02', isPaid: false },
    ]

    const forecast = buildNextCycleForecast(settings, goals, loans, {}, undefined, subscriptions, upcomingExpenses)

    expect(forecast.currentMonth).toBe('2026-01')
    expect(forecast.targetMonth).toBe('2026-02')
    expect(forecast.creditCardPayment).toBe(3500)
    expect(forecast.freeCashBeforeCreditCard).toBe(1600)
    expect(forecast.freeCashAfterCreditCard).toBe(-1900)
    expect(forecast.totalRequired).toBe(11900)
    expect(forecast.lines.find(line => line.key === 'oneTime')?.amount).toBe(1200)
    expect(forecast.lines.find(line => line.key === 'debt')?.amount).toBe(1000)
  })

  it('keeps credit card repayment at zero when the card is not configured', () => {
    const settings: Settings = {
      monthlyIncome: 8000,
      monthlyExpenses: 5000,
      startMonth: '2026-01',
      horizonMonths: 6,
      emergencyFundBuckets: ['safety_cushion'],
    }

    const forecast = buildNextCycleForecast(settings, goals, [], {})

    expect(forecast.targetMonth).toBe('2026-02')
    expect(forecast.creditCardPayment).toBe(0)
    expect(forecast.freeCashAfterCreditCard).toBe(3000)
  })
})
