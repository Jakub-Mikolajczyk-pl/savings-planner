import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSchedule } from '../domain/allocation'
import { earliestSnapshotMonth } from '../domain/accounts'
import { currentYearMonth } from '../domain/formatting'
import type {
  Account,
  AccountSnapshot,
  Goal,
  Loan,
  Settings,
  Overrides,
  Schedule,
  MortgagePlan,
  Subscription,
  UpcomingExpense,
} from '../domain/types'

interface AppState {
  settings: Settings
  goals: Goal[]
  loans: Loan[]
  accounts: Account[]
  accountSnapshots: AccountSnapshot[]
  mortgagePlan?: MortgagePlan
  subscriptions: Subscription[]
  upcomingExpenses: UpcomingExpense[]
  overrides: Overrides
  whatIfDelta: number
  loanOverpayment: number

  // Actions
  updateSettings: (patch: Partial<Settings>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'priority'>) => void
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void
  removeGoal: (id: string) => void
  reorderGoals: (orderedIds: string[]) => void
  addLoan: (loan: Omit<Loan, 'id'>) => void
  updateLoan: (id: string, patch: Partial<Omit<Loan, 'id'>>) => void
  removeLoan: (id: string) => void
  addAccount: (account: Omit<Account, 'id' | 'currency'> & { currency?: string }) => void
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void
  removeAccount: (id: string) => void
  closeAccount: (id: string, yearMonth: string) => void
  reopenAccount: (id: string) => void
  setSnapshot: (accountId: string, yearMonth: string, balance: number, notes?: string) => void
  removeSnapshot: (accountId: string, yearMonth: string) => void
  saveMortgagePlan: (plan: Omit<MortgagePlan, 'id'> & { id?: string }) => void
  removeMortgagePlan: () => void
  addSubscription: (subscription: Omit<Subscription, 'id'>) => void
  updateSubscription: (id: string, patch: Partial<Omit<Subscription, 'id'>>) => void
  removeSubscription: (id: string) => void
  toggleSubscription: (id: string) => void
  addUpcomingExpense: (expense: Omit<UpcomingExpense, 'id'>) => void
  updateUpcomingExpense: (id: string, patch: Partial<Omit<UpcomingExpense, 'id'>>) => void
  removeUpcomingExpense: (id: string) => void
  toggleUpcomingPaid: (id: string) => void
  setOverride: (yearMonth: string, patch: Partial<Omit<Overrides[string], 'perGoalAllocation'>>) => void
  setGoalAllocationOverride: (yearMonth: string, goalId: string, amount: number | null) => void
  clearOverride: (yearMonth: string) => void
  setWhatIfDelta: (delta: number) => void
  setLoanOverpayment: (amount: number) => void
  exportData: () => string
  importData: (json: string) => void
  resetAll: () => void

  // Derived (computed on every call)
  getSchedule: () => Schedule
  getWhatIfSchedule: () => Schedule
}

const defaultSettings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: currentYearMonth(),
  horizonMonths: 36,
  emergencyFundBuckets: ['cash', 'investment'],
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      goals: [],
      loans: [],
      accounts: [],
      accountSnapshots: [],
      mortgagePlan: undefined,
      subscriptions: [],
      upcomingExpenses: [],
      overrides: {},
      whatIfDelta: 0,
      loanOverpayment: 0,

      updateSettings: (patch) =>
        set(s => ({ settings: { ...s.settings, ...patch } })),

      addGoal: (goalData) =>
        set(s => {
          const maxPriority = s.goals.reduce((m, g) => Math.max(m, g.priority), 0)
          const goal: Goal = {
            ...goalData,
            id: crypto.randomUUID(),
            priority: maxPriority + 1,
          }
          return { goals: [...s.goals, goal] }
        }),

      updateGoal: (id, patch) =>
        set(s => ({
          goals: s.goals.map(g => (g.id === id ? { ...g, ...patch } : g)),
        })),

      removeGoal: (id) =>
        set(s => ({ goals: s.goals.filter(g => g.id !== id) })),

      reorderGoals: (orderedIds) =>
        set(s => ({
          goals: orderedIds.map((id, index) => {
            const goal = s.goals.find(g => g.id === id)!
            return { ...goal, priority: index + 1 }
          }),
        })),

      addLoan: (loanData) =>
        set(s => ({ loans: [...s.loans, { ...loanData, id: crypto.randomUUID() }] })),

      updateLoan: (id, patch) =>
        set(s => ({ loans: s.loans.map(l => l.id === id ? { ...l, ...patch } : l) })),

      removeLoan: (id) =>
        set(s => ({ loans: s.loans.filter(l => l.id !== id) })),

      addAccount: (accountData) =>
        set(s => ({
          accounts: [
            ...s.accounts,
            { ...accountData, currency: accountData.currency ?? 'PLN', id: crypto.randomUUID() },
          ],
        })),

      updateAccount: (id, patch) =>
        set(s => ({
          accounts: s.accounts.map(account => account.id === id ? { ...account, ...patch } : account),
        })),

      removeAccount: (id) =>
        set(s => ({
          accounts: s.accounts.filter(account => account.id !== id),
          accountSnapshots: s.accountSnapshots.filter(snapshot => snapshot.accountId !== id),
        })),

      closeAccount: (id, yearMonth) =>
        set(s => ({
          accounts: s.accounts.map(account => account.id === id ? { ...account, closedAt: yearMonth } : account),
        })),

      reopenAccount: (id) =>
        set(s => ({
          accounts: s.accounts.map(account => account.id === id ? { ...account, closedAt: undefined } : account),
        })),

      setSnapshot: (accountId, yearMonth, balance, notes) =>
        set(s => {
          const snapshot: AccountSnapshot = { accountId, yearMonth, balance, notes }
          const exists = s.accountSnapshots.some(item => item.accountId === accountId && item.yearMonth === yearMonth)
          const accountSnapshots = exists
            ? s.accountSnapshots.map(item => item.accountId === accountId && item.yearMonth === yearMonth ? snapshot : item)
            : [...s.accountSnapshots, snapshot]
          const openedAt = earliestSnapshotMonth(accountSnapshots, accountId)

          return {
            accountSnapshots,
            accounts: s.accounts.map(account => account.id === accountId ? { ...account, openedAt } : account),
          }
        }),

      removeSnapshot: (accountId, yearMonth) =>
        set(s => {
          const accountSnapshots = s.accountSnapshots.filter(
            snapshot => !(snapshot.accountId === accountId && snapshot.yearMonth === yearMonth),
          )
          const openedAt = earliestSnapshotMonth(accountSnapshots, accountId)

          return {
            accountSnapshots,
            accounts: s.accounts.map(account => account.id === accountId ? { ...account, openedAt } : account),
          }
        }),

      saveMortgagePlan: (planData) =>
        set(s => ({
          mortgagePlan: {
            ...planData,
            id: planData.id ?? s.mortgagePlan?.id ?? crypto.randomUUID(),
          },
        })),

      removeMortgagePlan: () => set({ mortgagePlan: undefined }),

      addSubscription: (subscriptionData) =>
        set(s => ({
          subscriptions: [...s.subscriptions, { ...subscriptionData, id: crypto.randomUUID() }],
        })),

      updateSubscription: (id, patch) =>
        set(s => ({
          subscriptions: s.subscriptions.map(subscription =>
            subscription.id === id ? { ...subscription, ...patch } : subscription,
          ),
        })),

      removeSubscription: (id) =>
        set(s => ({ subscriptions: s.subscriptions.filter(subscription => subscription.id !== id) })),

      toggleSubscription: (id) =>
        set(s => ({
          subscriptions: s.subscriptions.map(subscription =>
            subscription.id === id ? { ...subscription, active: !subscription.active } : subscription,
          ),
        })),

      addUpcomingExpense: (expenseData) =>
        set(s => ({
          upcomingExpenses: [...s.upcomingExpenses, { ...expenseData, id: crypto.randomUUID() }],
        })),

      updateUpcomingExpense: (id, patch) =>
        set(s => ({
          upcomingExpenses: s.upcomingExpenses.map(expense =>
            expense.id === id ? { ...expense, ...patch } : expense,
          ),
        })),

      removeUpcomingExpense: (id) =>
        set(s => ({ upcomingExpenses: s.upcomingExpenses.filter(expense => expense.id !== id) })),

      toggleUpcomingPaid: (id) =>
        set(s => ({
          upcomingExpenses: s.upcomingExpenses.map(expense =>
            expense.id === id ? { ...expense, isPaid: !expense.isPaid } : expense,
          ),
        })),

      setOverride: (yearMonth, patch) =>
        set(s => ({
          overrides: {
            ...s.overrides,
            [yearMonth]: { ...s.overrides[yearMonth], ...patch },
          },
        })),

      setGoalAllocationOverride: (yearMonth, goalId, amount) =>
        set(s => {
          const current = s.overrides[yearMonth] ?? {}
          const perGoal = { ...(current.perGoalAllocation ?? {}) }
          if (amount === null) {
            delete perGoal[goalId]
          } else {
            perGoal[goalId] = amount
          }
          const withoutPerGoal = Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== 'perGoalAllocation'),
          )
          const updated = Object.keys(perGoal).length === 0
            ? withoutPerGoal
            : { ...current, perGoalAllocation: perGoal }
          return { overrides: { ...s.overrides, [yearMonth]: updated } }
        }),

      clearOverride: (yearMonth) =>
        set(s => {
          const rest = Object.fromEntries(
            Object.entries(s.overrides).filter(([key]) => key !== yearMonth),
          )
          return { overrides: rest }
        }),

      setWhatIfDelta: (delta) => set({ whatIfDelta: delta }),
      setLoanOverpayment: (amount) => set({ loanOverpayment: amount }),

      exportData: () => {
        const {
          settings,
          goals,
          loans,
          accounts,
          accountSnapshots,
          mortgagePlan,
          subscriptions,
          upcomingExpenses,
          overrides,
        } = get()
        return JSON.stringify({
          settings,
          goals,
          loans,
          accounts,
          accountSnapshots,
          mortgagePlan,
          subscriptions,
          upcomingExpenses,
          overrides,
        }, null, 2)
      },

      importData: (json) => {
        const data = JSON.parse(json)
        set({
          settings: { ...defaultSettings, ...(data.settings ?? {}) },
          goals: data.goals ?? [],
          loans: data.loans ?? [],
          accounts: data.accounts ?? [],
          accountSnapshots: data.accountSnapshots ?? [],
          mortgagePlan: data.mortgagePlan,
          subscriptions: data.subscriptions ?? [],
          upcomingExpenses: data.upcomingExpenses ?? [],
          overrides: data.overrides ?? {},
        })
      },

      resetAll: () =>
        set({
          settings: defaultSettings,
          goals: [],
          loans: [],
          accounts: [],
          accountSnapshots: [],
          mortgagePlan: undefined,
          subscriptions: [],
          upcomingExpenses: [],
          overrides: {},
          whatIfDelta: 0,
          loanOverpayment: 0,
        }),

      getSchedule: () => {
        const { settings, goals, loans, mortgagePlan, subscriptions, upcomingExpenses, overrides } = get()
        return buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses)
      },

      getWhatIfSchedule: () => {
        const {
          settings,
          goals,
          loans,
          mortgagePlan,
          subscriptions,
          upcomingExpenses,
          overrides,
          whatIfDelta,
          loanOverpayment,
        } = get()
        return buildSchedule(
          settings,
          goals,
          loans,
          overrides,
          whatIfDelta,
          loanOverpayment,
          mortgagePlan,
          subscriptions,
          upcomingExpenses,
        )
      },
    }),
    {
      name: 'savings-planner-v1',
      partialize: (s) => ({
        settings: s.settings,
        goals: s.goals,
        loans: s.loans,
        accounts: s.accounts,
        accountSnapshots: s.accountSnapshots,
        mortgagePlan: s.mortgagePlan,
        subscriptions: s.subscriptions,
        upcomingExpenses: s.upcomingExpenses,
        overrides: s.overrides,
      }),
    },
  ),
)
