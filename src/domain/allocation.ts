import type { Goal, Settings, Overrides, Schedule, MonthRow, GoalAllocation, GoalProgress } from './types'
import { addMonths, formatYearMonth, monthDiff, dateToYearMonth } from './formatting'

interface GoalState {
  goalId: string
  balance: number
  isComplete: boolean
}

/**
 * Calculates urgency score for a goal — higher means it needs money sooner.
 * Goals without a deadline get a baseline score based on priority.
 */
function urgencyScore(goal: Goal, currentMonth: string, remaining: number): number {
  if (!goal.deadline) {
    // No deadline: lower priority number = higher urgency baseline
    return 1 / goal.priority
  }
  const deadlineMonth = dateToYearMonth(goal.deadline)
  const monthsLeft = monthDiff(currentMonth, deadlineMonth)
  if (monthsLeft <= 0) return Infinity // deadline passed or this month
  return remaining / monthsLeft
}

/**
 * Allocates free cash for a single month across all active goals.
 *
 * Algorithm:
 * 1. Subtract fixed allocations from the pool first.
 * 2. Remaining pool → distributed to non-fixed goals sorted by urgency (desc).
 *    Urgency = remaining_amount / months_to_deadline (or 1/priority if no deadline).
 * 3. Completed goals absorb 0; their overshoot flows to next urgent goal.
 */
function allocateMonth(
  freeCash: number,
  goals: Goal[],
  states: GoalState[],
  currentMonth: string,
): GoalAllocation[] {
  if (freeCash <= 0) {
    return goals.map(g => {
      const state = states.find(s => s.goalId === g.id)!
      return { goalId: g.id, allocated: 0, balanceAfter: state.balance, isComplete: state.isComplete }
    })
  }

  const activeGoals = goals.filter(g => {
    const state = states.find(s => s.goalId === g.id)!
    return !state.isComplete
  })

  let pool = freeCash
  const allocationMap = new Map<string, number>()

  // Step 1: apply fixed allocations
  for (const goal of activeGoals) {
    if (goal.fixedAllocation && goal.fixedAllocation > 0) {
      const state = states.find(s => s.goalId === goal.id)!
      const needed = goal.targetAmount - state.balance
      const fixed = Math.min(goal.fixedAllocation, needed, pool)
      allocationMap.set(goal.id, fixed)
      pool -= fixed
    }
  }

  // Step 2: distribute remaining pool by urgency
  const nonFixed = activeGoals.filter(g => !g.fixedAllocation)
  const sorted = [...nonFixed].sort((a, b) => {
    const stateA = states.find(s => s.goalId === a.id)!
    const stateB = states.find(s => s.goalId === b.id)!
    const remainingA = a.targetAmount - stateA.balance
    const remainingB = b.targetAmount - stateB.balance
    return urgencyScore(b, currentMonth, remainingB) - urgencyScore(a, currentMonth, remainingA)
  })

  for (const goal of sorted) {
    if (pool <= 0) break
    const state = states.find(s => s.goalId === goal.id)!
    const needed = goal.targetAmount - state.balance
    const amount = Math.min(pool, needed)
    allocationMap.set(goal.id, amount)
    pool -= amount
  }

  // Step 3: build results and update states
  return goals.map(goal => {
    const state = states.find(s => s.goalId === goal.id)!
    const allocated = allocationMap.get(goal.id) ?? 0
    const newBalance = state.balance + allocated
    const isComplete = newBalance >= goal.targetAmount

    state.balance = newBalance
    state.isComplete = isComplete

    return { goalId: goal.id, allocated, balanceAfter: newBalance, isComplete }
  })
}

export function buildSchedule(
  settings: Settings,
  goals: Goal[],
  overrides: Overrides,
  whatIfDelta = 0, // additional income delta for what-if mode
): Schedule {
  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

  const states: GoalState[] = sortedGoals.map(g => ({
    goalId: g.id,
    balance: g.currentSaved ?? 0,
    isComplete: (g.currentSaved ?? 0) >= g.targetAmount,
  }))

  const rows: MonthRow[] = []

  for (let i = 0; i < settings.horizonMonths; i++) {
    const yearMonth = addMonths(settings.startMonth, i)
    const override = overrides[yearMonth] ?? {}

    const income = (override.income ?? settings.monthlyIncome) + whatIfDelta
    const expenses = override.expenses ?? settings.monthlyExpenses
    const freeCash = income - expenses
    const isDeficit = freeCash < 0

    const goalAllocations = allocateMonth(freeCash, sortedGoals, states, yearMonth)

    rows.push({
      yearMonth,
      label: formatYearMonth(yearMonth),
      income,
      expenses,
      freeCash,
      goalAllocations,
      isDeficit,
    })
  }

  const goalProgress: GoalProgress[] = sortedGoals.map(goal => {
    const completionRow = rows.find(r =>
      r.goalAllocations.find(a => a.goalId === goal.id && a.isComplete),
    )
    const finalState = states.find(s => s.goalId === goal.id)!
    const isComplete = finalState.isComplete
    const deadlineMissed = !!(
      goal.deadline &&
      !isComplete &&
      monthDiff(settings.startMonth, dateToYearMonth(goal.deadline)) < settings.horizonMonths
    )

    let shortfallPerMonth: number | undefined
    if (goal.deadline && !isComplete) {
      const monthsLeft = monthDiff(addMonths(settings.startMonth, 0), dateToYearMonth(goal.deadline))
      if (monthsLeft > 0) {
        const needed = goal.targetAmount - (goal.currentSaved ?? 0)
        const avgAllocated =
          rows.reduce((sum, r) => {
            const a = r.goalAllocations.find(a => a.goalId === goal.id)
            return sum + (a?.allocated ?? 0)
          }, 0) / rows.length
        shortfallPerMonth = Math.max(0, needed / monthsLeft - avgAllocated)
      }
    }

    return {
      goalId: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentBalance: finalState.balance,
      completionMonth: completionRow?.yearMonth,
      isComplete,
      shortfallPerMonth,
      deadlineMissed,
    }
  })

  return { rows, goalProgress }
}
