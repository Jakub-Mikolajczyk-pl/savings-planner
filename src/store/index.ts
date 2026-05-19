import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSchedule } from '../domain/allocation'
import { currentYearMonth } from '../domain/formatting'
import type { Goal, Loan, Settings, Overrides, Schedule } from '../domain/types'

interface AppState {
  settings: Settings
  goals: Goal[]
  loans: Loan[]
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
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      goals: [],
      loans: [],
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
          const updated = { ...current, perGoalAllocation: perGoal }
          if (Object.keys(updated.perGoalAllocation!).length === 0) delete updated.perGoalAllocation
          return { overrides: { ...s.overrides, [yearMonth]: updated } }
        }),

      clearOverride: (yearMonth) =>
        set(s => {
          const { [yearMonth]: _, ...rest } = s.overrides
          return { overrides: rest }
        }),

      setWhatIfDelta: (delta) => set({ whatIfDelta: delta }),
      setLoanOverpayment: (amount) => set({ loanOverpayment: amount }),

      exportData: () => {
        const { settings, goals, loans, overrides } = get()
        return JSON.stringify({ settings, goals, loans, overrides }, null, 2)
      },

      importData: (json) => {
        const data = JSON.parse(json)
        set({
          settings: data.settings ?? defaultSettings,
          goals: data.goals ?? [],
          loans: data.loans ?? [],
          overrides: data.overrides ?? {},
        })
      },

      resetAll: () =>
        set({ settings: defaultSettings, goals: [], loans: [], overrides: {}, whatIfDelta: 0, loanOverpayment: 0 }),

      getSchedule: () => {
        const { settings, goals, loans, overrides } = get()
        return buildSchedule(settings, goals, loans, overrides)
      },

      getWhatIfSchedule: () => {
        const { settings, goals, loans, overrides, whatIfDelta, loanOverpayment } = get()
        return buildSchedule(settings, goals, loans, overrides, whatIfDelta, loanOverpayment)
      },
    }),
    {
      name: 'savings-planner-v1',
      partialize: (s) => ({ settings: s.settings, goals: s.goals, loans: s.loans, overrides: s.overrides }),
    },
  ),
)
