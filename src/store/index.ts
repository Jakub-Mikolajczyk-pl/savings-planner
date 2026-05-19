import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSchedule } from '../domain/allocation'
import { currentYearMonth } from '../domain/formatting'
import type { Goal, Settings, Overrides, Schedule } from '../domain/types'

interface AppState {
  settings: Settings
  goals: Goal[]
  overrides: Overrides
  whatIfDelta: number

  // Actions
  updateSettings: (patch: Partial<Settings>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'priority'>) => void
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void
  removeGoal: (id: string) => void
  reorderGoals: (orderedIds: string[]) => void
  setOverride: (yearMonth: string, patch: Partial<Overrides[string]>) => void
  clearOverride: (yearMonth: string) => void
  setWhatIfDelta: (delta: number) => void
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
      overrides: {},
      whatIfDelta: 0,

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

      setOverride: (yearMonth, patch) =>
        set(s => ({
          overrides: {
            ...s.overrides,
            [yearMonth]: { ...s.overrides[yearMonth], ...patch },
          },
        })),

      clearOverride: (yearMonth) =>
        set(s => {
          const { [yearMonth]: _, ...rest } = s.overrides
          return { overrides: rest }
        }),

      setWhatIfDelta: (delta) => set({ whatIfDelta: delta }),

      exportData: () => {
        const { settings, goals, overrides } = get()
        return JSON.stringify({ settings, goals, overrides }, null, 2)
      },

      importData: (json) => {
        const data = JSON.parse(json)
        set({
          settings: data.settings ?? defaultSettings,
          goals: data.goals ?? [],
          overrides: data.overrides ?? {},
        })
      },

      resetAll: () =>
        set({ settings: defaultSettings, goals: [], overrides: {}, whatIfDelta: 0 }),

      getSchedule: () => {
        const { settings, goals, overrides } = get()
        return buildSchedule(settings, goals, overrides)
      },

      getWhatIfSchedule: () => {
        const { settings, goals, overrides, whatIfDelta } = get()
        return buildSchedule(settings, goals, overrides, whatIfDelta)
      },
    }),
    {
      name: 'savings-planner-v1',
    },
  ),
)
