export interface Goal {
  id: string
  name: string
  targetAmount: number
  deadline?: string // ISO date string "YYYY-MM-DD"
  priority: number  // lower = higher priority (1 is first)
  fixedAllocation?: number // fixed PLN/month regardless of priority calc
  currentSaved?: number // already saved before tracking started
}

export interface Settings {
  monthlyIncome: number
  monthlyExpenses: number
  startMonth: string // "YYYY-MM" format
  horizonMonths: number
}

export interface MonthOverride {
  income?: number
  expenses?: number
}

export interface Overrides {
  [yearMonth: string]: MonthOverride // key: "YYYY-MM"
}

export interface MonthRow {
  yearMonth: string       // "YYYY-MM"
  label: string           // "Maj 2026"
  income: number
  expenses: number
  freeCash: number        // income - expenses
  goalAllocations: GoalAllocation[]
  isDeficit: boolean
}

export interface GoalAllocation {
  goalId: string
  allocated: number
  balanceAfter: number
  isComplete: boolean
}

export interface GoalProgress {
  goalId: string
  name: string
  targetAmount: number
  currentBalance: number
  completionMonth?: string // "YYYY-MM" when goal is reached
  isComplete: boolean
  shortfallPerMonth?: number // if deadline can't be met
  deadlineMissed: boolean
}

export interface Schedule {
  rows: MonthRow[]
  goalProgress: GoalProgress[]
}
