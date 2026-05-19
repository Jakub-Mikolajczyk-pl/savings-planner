export interface Loan {
  id: string
  name: string
  remainingBalance: number  // current outstanding balance
  monthlyPayment: number    // minimum monthly payment
}

export interface LoanMonthEntry {
  loanId: string
  payment: number       // actual payment this month
  balanceAfter: number
  isPaidOff: boolean
}

export interface LoanProgress {
  loanId: string
  name: string
  initialBalance: number
  monthlyPayment: number
  payoffMonth?: string          // "YYYY-MM" within horizon
  projectedPayoffMonth?: string // beyond horizon
}

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
  perGoalAllocation?: Record<string, number> // goalId → manual allocation
}

export interface Overrides {
  [yearMonth: string]: MonthOverride // key: "YYYY-MM"
}

export interface MonthRow {
  yearMonth: string
  label: string
  income: number
  expenses: number
  loanPaymentsTotal: number
  freeCash: number
  goalAllocations: GoalAllocation[]
  loanEntries: LoanMonthEntry[]
  isDeficit: boolean
}

export interface GoalAllocation {
  goalId: string
  allocated: number
  balanceAfter: number
  isComplete: boolean
  isManualOverride: boolean
}

export interface GoalProgress {
  goalId: string
  name: string
  targetAmount: number
  currentBalance: number
  completionMonth?: string   // within horizon
  projectedETA?: string      // computed if not within horizon
  isComplete: boolean
  deadline?: string          // "YYYY-MM" of the goal's deadline
  deadlineMissed: boolean    // true if completion is after deadline (or won't complete before deadline)
  deadlineOnTime: boolean    // true if deadline exists and will be met
  shortfallPerMonth?: number
}

export interface Schedule {
  rows: MonthRow[]
  goalProgress: GoalProgress[]
  loanProgress: LoanProgress[]
}
