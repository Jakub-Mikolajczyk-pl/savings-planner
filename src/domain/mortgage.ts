import type { MortgageMonthEntry, MortgagePlan, MortgageSummary } from './types'
import { addMonths } from './formatting'

const roundMoney = (value: number): number => Math.round(value * 100) / 100

export function calculateMortgagePayment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0
  if (monthlyRate === 0) return roundMoney(balance / months)
  const factor = Math.pow(1 + monthlyRate, months)
  return roundMoney(balance * (monthlyRate * factor) / (factor - 1))
}

function monthlyRate(annualInterestRate: number): number {
  return annualInterestRate / 100 / 12
}

function estimatedPayment(plan: MortgagePlan, annualInterestRate = plan.annualInterestRate): number {
  const originalTermMonths = plan.originalTermMonths ?? plan.termMonths
  return calculateMortgagePayment(plan.principal, monthlyRate(annualInterestRate), originalTermMonths)
}

function basePayment(plan: MortgagePlan): number {
  return estimatedPayment(plan)
}

function oneTimeOverpaymentFor(plan: MortgagePlan, yearMonth: string): number {
  return plan.oneTimeOverpayments
    .filter(o => o.yearMonth === yearMonth)
    .reduce((sum, o) => sum + o.amount, 0)
}

function buildEntries(
  plan: MortgagePlan,
  startMonth: string,
  horizonMonths: number,
  withOverpayments: boolean,
  padAfterPayoff: boolean,
  annualInterestRate = plan.annualInterestRate,
  initialMonthlyPayment = basePayment(plan),
): MortgageMonthEntry[] {
  const rate = monthlyRate(annualInterestRate)
  const originalTermMonths = plan.originalTermMonths ?? plan.termMonths
  let balance = plan.principal
  let currentPayment = initialMonthlyPayment
  let cumulativeInterest = 0
  const entries: MortgageMonthEntry[] = []

  for (let i = 0; i < horizonMonths; i++) {
    const yearMonth = addMonths(startMonth, i)
    if (balance <= 0) {
      if (!padAfterPayoff) break
      entries.push({
        yearMonth,
        payment: 0,
        interest: 0,
        principalPaid: 0,
        overpayment: 0,
        balanceAfter: 0,
        cumulativeInterest,
        isPaidOff: true,
      })
      continue
    }

    const interest = roundMoney(balance * rate)
    const scheduledPayment = Math.min(currentPayment, balance + interest)
    const principalPaid = Math.max(0, roundMoney(scheduledPayment - interest))
    const plannedOverpayment = withOverpayments
      ? plan.monthlyOverpayment + oneTimeOverpaymentFor(plan, yearMonth)
      : 0
    const overpayment = Math.min(plannedOverpayment, Math.max(0, balance - principalPaid))
    balance = roundMoney(balance - principalPaid - overpayment)
    cumulativeInterest = roundMoney(cumulativeInterest + interest)

    entries.push({
      yearMonth,
      payment: roundMoney(scheduledPayment),
      interest,
      principalPaid,
      overpayment: roundMoney(overpayment),
      balanceAfter: Math.max(0, balance),
      cumulativeInterest,
      isPaidOff: balance <= 0,
    })

    if (withOverpayments && plan.overpaymentMode === 'reducePayment' && balance > 0 && overpayment > 0) {
      const remainingMonths = Math.max(1, originalTermMonths - i - 1)
      currentPayment = calculateMortgagePayment(balance, rate, remainingMonths)
    }
  }

  return entries
}

function totalInterestToPayoff(entries: MortgageMonthEntry[]): number {
  const payoffIndex = entries.findIndex(e => e.isPaidOff)
  const relevant = payoffIndex >= 0 ? entries.slice(0, payoffIndex + 1) : entries
  return roundMoney(relevant.reduce((sum, e) => sum + e.interest, 0))
}

export function buildMortgageSchedule(
  plan: MortgagePlan | undefined,
  startMonth: string,
  horizonMonths: number,
  fullSchedule = false,
): { entries: MortgageMonthEntry[]; summary?: MortgageSummary } {
  if (!plan || plan.principal <= 0 || plan.termMonths <= 0 || plan.annualInterestRate < 0) {
    return { entries: [] }
  }

  const originalTermMonths = plan.originalTermMonths ?? plan.termMonths
  const summaryHorizon = Math.max(horizonMonths, originalTermMonths + 1)
  const elapsedMonths = Math.max(0, originalTermMonths - plan.termMonths)
  const regularPayment = basePayment(plan)
  const entries = buildEntries(
    plan,
    startMonth,
    fullSchedule ? summaryHorizon : horizonMonths,
    true,
    !fullSchedule,
  )
  const baseEntries = buildEntries(plan, startMonth, summaryHorizon, false, false)
  const fullActualEntries = buildEntries(plan, startMonth, summaryHorizon, true, false)
  const basePayoffIndex = baseEntries.findIndex(e => e.isPaidOff)
  const actualPayoffIndex = fullActualEntries.findIndex(e => e.isPaidOff)
  const baseTotalInterest = totalInterestToPayoff(baseEntries)
  const totalInterest = totalInterestToPayoff(fullActualEntries)
  const currentMonthlyPayment = fullActualEntries.find(e => e.payment > 0)?.payment ?? 0
  const refinance = buildRefinanceSummary(plan, startMonth, summaryHorizon, baseEntries, regularPayment)

  return {
    entries,
    summary: {
      name: plan.name,
      baseMonthlyPayment: regularPayment,
      currentMonthlyPayment,
      elapsedMonths,
      estimatedStartMonth: addMonths(startMonth, -elapsedMonths),
      payoffMonth: actualPayoffIndex >= 0 ? fullActualEntries[actualPayoffIndex]?.yearMonth : undefined,
      remainingMonths: plan.termMonths,
      originalTermMonths,
      monthsSaved: basePayoffIndex >= 0 && actualPayoffIndex >= 0 ? Math.max(0, basePayoffIndex - actualPayoffIndex) : 0,
      interestSaved: Math.max(0, roundMoney(baseTotalInterest - totalInterest)),
      totalInterest,
      baseTotalInterest,
      refinance,
    },
  }
}

function buildRefinanceSummary(
  plan: MortgagePlan,
  startMonth: string,
  horizonMonths: number,
  baseEntries: MortgageMonthEntry[],
  regularPayment: number,
): MortgageSummary['refinance'] {
  const refinanceRate = plan.refinanceAnnualInterestRate
  if (!refinanceRate || refinanceRate <= 0 || refinanceRate >= plan.annualInterestRate) return undefined

  const refinanceCost = plan.refinanceCost ?? 0
  const refinancePayment = estimatedPayment(plan, refinanceRate)
  const refinanceEntries = buildEntries(
    plan,
    startMonth,
    horizonMonths,
    false,
    false,
    refinanceRate,
    refinancePayment,
  )
  const payoffIndex = refinanceEntries.findIndex(e => e.isPaidOff)
  const baseInterest = totalInterestToPayoff(baseEntries)
  const refinanceInterest = totalInterestToPayoff(refinanceEntries)
  const interestSaved = Math.max(0, roundMoney(baseInterest - refinanceInterest))

  return {
    annualInterestRate: refinanceRate,
    monthlyPayment: refinancePayment,
    monthlyPaymentDelta: roundMoney(regularPayment - refinancePayment),
    totalInterest: refinanceInterest,
    interestSaved,
    netSavings: roundMoney(interestSaved - refinanceCost),
    refinanceCost,
    payoffMonth: payoffIndex >= 0 ? refinanceEntries[payoffIndex]?.yearMonth : undefined,
  }
}
