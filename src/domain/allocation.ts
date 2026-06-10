import type {
  Goal,
  Loan,
  Settings,
  Overrides,
  Schedule,
  MonthRow,
  GoalAllocation,
  GoalProgress,
  LoanMonthEntry,
  LoanProgress,
  MortgagePlan,
  Subscription,
  UpcomingExpense,
} from './types'
import { addMonths, formatYearMonth, monthDiff, dateToYearMonth } from './formatting'
import { ikzeMonthlyContributionCost, calculateProjectedIkzeRefund } from './ikze'
import { ikeMonthlyContributionCost } from './ike'
import { ppkMonthlyEmployeeCost } from './ppk'
import { buildMortgageSchedule } from './mortgage'

interface GoalState {
  goalId: string
  balance: number
  isComplete: boolean
}

function urgencyScore(goal: Goal, currentMonth: string, remaining: number): number {
  if (!goal.deadline) return 1 / goal.priority
  const deadlineMonth = dateToYearMonth(goal.deadline)
  const monthsLeft = monthDiff(currentMonth, deadlineMonth)
  if (monthsLeft <= 0) return Infinity
  return remaining / monthsLeft
}

function allocateMonth(
  freeCash: number,
  goals: Goal[],
  states: GoalState[],
  currentMonth: string,
  manualOverrides: Record<string, number>,
  bonusPool = 0,
): GoalAllocation[] {
  if (freeCash <= 0 && bonusPool <= 0) {
    return goals.map(g => {
      const state = states.find(s => s.goalId === g.id)!
      return { goalId: g.id, allocated: 0, balanceAfter: state.balance, isComplete: state.isComplete, isManualOverride: false }
    })
  }

  const activeGoals = goals.filter(g => !states.find(s => s.goalId === g.id)!.isComplete)
  let pool = Math.max(0, freeCash)
  const allocationMap = new Map<string, number>()
  const overriddenIds = new Set<string>()

  // Step 1: apply manual per-goal overrides (from schedule table edits)
  for (const goal of activeGoals) {
    const manual = manualOverrides[goal.id]
    if (manual !== undefined) {
      const state = states.find(s => s.goalId === goal.id)!
      const needed = goal.targetAmount - state.balance
      const amount = Math.min(manual, needed, pool)
      allocationMap.set(goal.id, amount)
      pool -= amount
      overriddenIds.add(goal.id)
    }
  }

  // Step 2: fixed allocations for non-overridden goals
  for (const goal of activeGoals) {
    if (overriddenIds.has(goal.id)) continue
    if (goal.fixedAllocation && goal.fixedAllocation > 0) {
      const state = states.find(s => s.goalId === goal.id)!
      const needed = goal.targetAmount - state.balance
      const fixed = Math.min(goal.fixedAllocation, needed, pool)
      allocationMap.set(goal.id, fixed)
      pool -= fixed
    }
  }

  // Step 3: urgency-based distribution for remaining non-overridden, non-fixed goals
  const flexGoals = activeGoals.filter(g => !overriddenIds.has(g.id) && !g.fixedAllocation)
  const sorted = [...flexGoals].sort((a, b) => {
    const stateA = states.find(s => s.goalId === a.id)!
    const stateB = states.find(s => s.goalId === b.id)!
    return urgencyScore(b, currentMonth, b.targetAmount - stateB.balance)
         - urgencyScore(a, currentMonth, a.targetAmount - stateA.balance)
  })

  for (const goal of sorted) {
    if (pool <= 0) break
    const state = states.find(s => s.goalId === goal.id)!
    const needed = goal.targetAmount - state.balance
    const amount = Math.min(pool, needed)
    allocationMap.set(goal.id, amount)
    pool -= amount
  }

  // Step 4: bonus pool (positive what-if delta) — extra savings on top of fixed allocations,
  // distributed urgency-sorted across all incomplete goals
  if (bonusPool > 0) {
    const incompleteSorted = [...activeGoals].sort((a, b) => {
      const stateA = states.find(s => s.goalId === a.id)!
      const stateB = states.find(s => s.goalId === b.id)!
      const remA = a.targetAmount - stateA.balance - (allocationMap.get(a.id) ?? 0)
      const remB = b.targetAmount - stateB.balance - (allocationMap.get(b.id) ?? 0)
      return urgencyScore(b, currentMonth, remB) - urgencyScore(a, currentMonth, remA)
    })
    let remainingBonus = bonusPool
    for (const goal of incompleteSorted) {
      if (remainingBonus <= 0) break
      const state = states.find(s => s.goalId === goal.id)!
      const alreadyAllocated = allocationMap.get(goal.id) ?? 0
      const needed = goal.targetAmount - state.balance - alreadyAllocated
      if (needed <= 0) continue
      const bonus = Math.min(remainingBonus, needed)
      allocationMap.set(goal.id, alreadyAllocated + bonus)
      remainingBonus -= bonus
    }
  }

  // Step 5: build results, mutate states
  return goals.map(goal => {
    const state = states.find(s => s.goalId === goal.id)!
    const allocated = allocationMap.get(goal.id) ?? 0
    const newBalance = state.balance + allocated
    const isComplete = newBalance >= goal.targetAmount
    state.balance = newBalance
    state.isComplete = isComplete
    return { goalId: goal.id, allocated, balanceAfter: newBalance, isComplete, isManualOverride: overriddenIds.has(goal.id) }
  })
}

export function buildSchedule(
  settings: Settings,
  goals: Goal[],
  loans: Loan[],
  overrides: Overrides,
  whatIfDelta = 0,
  loanOverpayment = 0,
  mortgagePlan?: MortgagePlan,
  subscriptions: Subscription[] = [],
  upcomingExpenses: UpcomingExpense[] = [],
): Schedule {
  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)
  const states: GoalState[] = sortedGoals.map(g => ({
    goalId: g.id,
    balance: g.currentSaved ?? 0,
    isComplete: (g.currentSaved ?? 0) >= g.targetAmount,
  }))

  // Mutable loan balances for this schedule run
  const loanBalances = new Map<string, number>(loans.map(l => [l.id, l.remainingBalance]))

  const rows: MonthRow[] = []
  const { entries: mortgageEntries, summary: mortgageSummary } = buildMortgageSchedule(
    mortgagePlan,
    settings.startMonth,
    settings.horizonMonths,
  )
  const subscriptionsTotal = subscriptions
    .filter(subscription => subscription.active)
    .reduce((sum, subscription) => sum + subscription.monthlyAmount, 0)
  const ikzeContributionTotal = ikzeMonthlyContributionCost(settings)
  const ikeContributionTotal = ikeMonthlyContributionCost(settings)
  const ppkContributionTotal = ppkMonthlyEmployeeCost(settings)

  for (let i = 0; i < settings.horizonMonths; i++) {
    const yearMonth = addMonths(settings.startMonth, i)
    const override = overrides[yearMonth] ?? {}
    const baseIncome = override.income ?? settings.monthlyIncome
    const expenses = override.expenses ?? settings.monthlyExpenses
    const oneTimeExpensesTotal = upcomingExpenses
      .filter(expense => !expense.isPaid && expense.targetMonth === yearMonth)
      .reduce((sum, expense) => sum + expense.amount, 0)
    const expensesTotal = expenses + subscriptionsTotal + oneTimeExpensesTotal + ikzeContributionTotal + ikeContributionTotal + ppkContributionTotal
    const income = baseIncome + whatIfDelta
    const grossFreeCash = baseIncome + Math.min(0, whatIfDelta) - expensesTotal

    // Process loans: distribute loanOverpayment to highest-balance loan first
    const loanEntries: LoanMonthEntry[] = []
    let totalLoanPayment = 0

    // Sort loans: highest remaining balance first (avalanche method for overpayment)
    const loansThisMonth = [...loans].sort(
      (a, b) => (loanBalances.get(b.id) ?? 0) - (loanBalances.get(a.id) ?? 0)
    )
    let remainingOverpayment = loanOverpayment

    for (const loan of loansThisMonth) {
      const balance = loanBalances.get(loan.id) ?? 0
      if (balance <= 0) {
        loanEntries.push({ loanId: loan.id, payment: 0, balanceAfter: 0, isPaidOff: true })
        continue
      }
      const overpay = Math.min(remainingOverpayment, balance)
      remainingOverpayment -= overpay
      const payment = Math.min(loan.monthlyPayment + overpay, balance)
      const balanceAfter = balance - payment
      loanBalances.set(loan.id, balanceAfter)
      loanEntries.push({ loanId: loan.id, payment, balanceAfter, isPaidOff: balanceAfter <= 0 })
      totalLoanPayment += payment
    }

    const mortgageEntry = mortgageEntries[i]
    const mortgagePaymentTotal = mortgageEntry
      ? mortgageEntry.payment + mortgageEntry.overpayment
      : 0

    // Calculate expected IKZE Tax Refund in May of the following year
    let ikzeTaxRefund = 0
    if (yearMonth.endsWith('-05')) {
      const [currentYear] = yearMonth.split('-').map(Number)
      const taxYear = currentYear - 1
      const matchingPlans = settings.ikzePlans?.filter(p => p.year === taxYear) ?? []
      for (const plan of matchingPlans) {
        ikzeTaxRefund += calculateProjectedIkzeRefund(plan, settings.includeIkzeContributionsInCashflow ?? false)
      }
    }

    // Savings allocation uses what's left after loan payments
    const savingsPool = grossFreeCash - totalLoanPayment - mortgagePaymentTotal + ikzeTaxRefund
    const bonusPool = Math.max(0, whatIfDelta)
    const manualAlloc = override.perGoalAllocation ?? {}
    const goalAllocations = allocateMonth(savingsPool, sortedGoals, states, yearMonth, manualAlloc, bonusPool)

    // freeCash = what's actually left for savings after expenses AND loan payments
    const freeCash = income + ikzeTaxRefund - expensesTotal - totalLoanPayment - mortgagePaymentTotal
    rows.push({
      yearMonth,
      label: formatYearMonth(yearMonth),
      income,
      expenses,
      subscriptionsTotal,
      oneTimeExpensesTotal,
      loanPaymentsTotal: totalLoanPayment,
      mortgagePaymentTotal,
      ikzeContributionTotal,
      ikzeTaxRefund,
      ikeContributionTotal,
      ppkContributionTotal,
      freeCash,
      goalAllocations,
      loanEntries,
      mortgageEntry,
      isDeficit: freeCash < 0,
    })
  }

  const goalProgress: GoalProgress[] = sortedGoals.map(goal => {
    const completionRow = rows.find(r => r.goalAllocations.find(a => a.goalId === goal.id && a.isComplete))
    const finalState = states.find(s => s.goalId === goal.id)!
    const isComplete = finalState.isComplete
    const deadlineYM = goal.deadline ? dateToYearMonth(goal.deadline) : undefined
    const completionYM = completionRow?.yearMonth

    // Missed if: has deadline AND (goal never completes within horizon, OR completes after deadline)
    const deadlineMissed = !!(deadlineYM && (
      !completionYM || completionYM > deadlineYM
    ))
    const deadlineOnTime = !!(deadlineYM && completionYM && completionYM <= deadlineYM)

    // Projected ETA beyond horizon
    let projectedETA: string | undefined
    if (!isComplete) {
      const totalAllocated = rows.reduce((sum, r) => {
        const a = r.goalAllocations.find(a => a.goalId === goal.id)
        return sum + (a?.allocated ?? 0)
      }, 0)
      const avgPerMonth = totalAllocated / settings.horizonMonths
      if (avgPerMonth > 0) {
        const totalNeeded = goal.targetAmount - (goal.currentSaved ?? 0)
        const monthsNeeded = Math.ceil(totalNeeded / avgPerMonth)
        projectedETA = addMonths(settings.startMonth, monthsNeeded)
      }
    }

    // Shortfall: how much extra/month needed to hit deadline
    let shortfallPerMonth: number | undefined
    if (deadlineYM && deadlineMissed) {
      const monthsToDeadline = monthDiff(settings.startMonth, deadlineYM)
      if (monthsToDeadline > 0) {
        const needed = goal.targetAmount - (goal.currentSaved ?? 0)
        const monthsCovered = Math.min(monthsToDeadline, rows.length)
        const avgAllocated = rows.slice(0, monthsCovered).reduce((sum, r) => {
          const a = r.goalAllocations.find(a => a.goalId === goal.id)
          return sum + (a?.allocated ?? 0)
        }, 0) / monthsCovered
        shortfallPerMonth = Math.max(0, needed / monthsToDeadline - avgAllocated)
      }
    }

    return {
      goalId: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentBalance: finalState.balance,
      completionMonth: completionYM,
      projectedETA,
      isComplete,
      deadline: deadlineYM,
      deadlineMissed,
      deadlineOnTime,
      shortfallPerMonth,
    }
  })

  const loanProgress: LoanProgress[] = loans.map(loan => {
    const payoffRow = rows.find(r =>
      r.loanEntries.find(e => e.loanId === loan.id && e.isPaidOff)
    )
    let projectedPayoffMonth: string | undefined
    if (!payoffRow) {
      const totalPaid = rows.reduce((sum, r) => {
        const e = r.loanEntries.find(e => e.loanId === loan.id)
        return sum + (e?.payment ?? 0)
      }, 0)
      const avgPerMonth = totalPaid / settings.horizonMonths
      if (avgPerMonth > 0) {
        const monthsNeeded = Math.ceil(loan.remainingBalance / avgPerMonth)
        projectedPayoffMonth = addMonths(settings.startMonth, monthsNeeded)
      }
    }
    return {
      loanId: loan.id,
      name: loan.name,
      initialBalance: loan.remainingBalance,
      monthlyPayment: loan.monthlyPayment,
      payoffMonth: payoffRow?.yearMonth,
      projectedPayoffMonth,
    }
  })

  return { rows, goalProgress, loanProgress, mortgageSummary }
}
