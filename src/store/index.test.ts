import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './index'

describe('useStore - subscriptions and upcoming expenses', () => {
  beforeEach(() => {
    useStore.getState().resetAll()
  })

  it('toggles subscriptions and paid upcoming expenses in schedule calculations', () => {
    const store = useStore.getState()
    store.updateSettings({
      monthlyIncome: 10000,
      monthlyExpenses: 6000,
      startMonth: '2026-01',
      horizonMonths: 3,
    })
    store.addGoal({ name: 'Poduszka', targetAmount: 12000, currentSaved: 0 })
    store.addSubscription({ name: 'Streaming', monthlyAmount: 100, active: true })
    store.addUpcomingExpense({ name: 'OC auta', amount: 900, targetMonth: '2026-02', isPaid: false })

    let schedule = useStore.getState().getSchedule()
    expect(schedule.rows[0].subscriptionsTotal).toBe(100)
    expect(schedule.rows[0].freeCash).toBe(3900)
    expect(schedule.rows[1].oneTimeExpensesTotal).toBe(900)
    expect(schedule.rows[1].freeCash).toBe(3000)

    const subscriptionId = useStore.getState().subscriptions[0].id
    const expenseId = useStore.getState().upcomingExpenses[0].id
    useStore.getState().toggleSubscription(subscriptionId)
    useStore.getState().toggleUpcomingPaid(expenseId)

    schedule = useStore.getState().getSchedule()
    expect(schedule.rows[0].subscriptionsTotal).toBe(0)
    expect(schedule.rows[1].oneTimeExpensesTotal).toBe(0)
    expect(schedule.rows[1].freeCash).toBe(4000)
  })

  it('keeps subscriptions and upcoming expenses in export and import', () => {
    useStore.getState().addSubscription({ name: 'Chmura', monthlyAmount: 49, active: true, category: 'IT' })
    useStore.getState().addUpcomingExpense({ name: 'Laptop', amount: 5000, targetMonth: '2026-05', isPaid: false })

    const exported = useStore.getState().exportData()
    useStore.getState().resetAll()
    useStore.getState().importData(exported)

    expect(useStore.getState().subscriptions).toMatchObject([
      { name: 'Chmura', monthlyAmount: 49, active: true, category: 'IT' },
    ])
    expect(useStore.getState().upcomingExpenses).toMatchObject([
      { name: 'Laptop', amount: 5000, targetMonth: '2026-05', isPaid: false },
    ])
  })

  it('keeps IKZE plans in export and import', () => {
    useStore.getState().updateSettings({
      ikzePlans: [
        {
          id: 'ikze-jakub-2026',
          year: 2026,
          ownerName: 'Jakub',
          role: 'entrepreneur',
          annualLimit: 15000,
          contributedAmount: 5000,
          payoutsLeft: 5,
        },
      ],
    })

    const exported = useStore.getState().exportData()
    useStore.getState().resetAll()
    useStore.getState().importData(exported)

    expect(useStore.getState().settings.ikzePlans).toMatchObject([
      {
        id: 'ikze-jakub-2026',
        ownerName: 'Jakub',
        role: 'entrepreneur',
        annualLimit: 15000,
        contributedAmount: 5000,
        payoutsLeft: 5,
      },
    ])
  })
})

describe('useStore - account snapshot months', () => {
  beforeEach(() => {
    useStore.getState().resetAll()
  })

  it('removes every snapshot from a selected month and keeps other months', () => {
    useStore.setState({
      accounts: [
        { id: 'main', name: 'Main', bucket: 'accounts', currency: 'PLN', openedAt: '2026-05' },
        { id: 'savings', name: 'Savings', bucket: 'safety_cushion', currency: 'PLN', openedAt: '2026-06' },
      ],
      accountSnapshots: [
        { accountId: 'main', yearMonth: '2026-05', balance: 1000 },
        { accountId: 'main', yearMonth: '2026-06', balance: 1200 },
        { accountId: 'savings', yearMonth: '2026-06', balance: 5000 },
      ],
    })

    useStore.getState().removeSnapshotsForMonth('2026-06')

    expect(useStore.getState().accountSnapshots).toEqual([
      { accountId: 'main', yearMonth: '2026-05', balance: 1000 },
    ])
    expect(useStore.getState().accounts).toMatchObject([
      { id: 'main', openedAt: '2026-05' },
      { id: 'savings', openedAt: undefined },
    ])
  })
})
