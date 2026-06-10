import type { IkzePlanEntry, IkzePlanStatus, Settings, IkzeParticipantRole } from './types'

export interface IkzeCalculatedEntry extends IkzePlanEntry {
  remaining: number
  perPayout: number
  status: IkzePlanStatus
}

export interface IkzeFamilySummary {
  annualLimit: number
  contributedAmount: number
  remaining: number
  perPayout: number
}

export const IKZE_LIMITS: Record<number, Record<IkzeParticipantRole, number>> = {
  2024: { employee: 9388.80, entrepreneur: 14083.20 },
  2025: { employee: 10430.40, entrepreneur: 15645.60 },
  2026: { employee: 11048.40, entrepreneur: 16572.60 },
}

const ceilToGrosze = (value: number) => value <= 0 ? 0 : Math.ceil((value - Number.EPSILON) * 100) / 100

export function payoutsLeftToYearEnd(yearMonth: string): number {
  const [, month] = yearMonth.split('-').map(Number)
  if (!month || month < 1 || month > 12) return 0
  return 12 - month + 1
}

export function calculateIkzeEntry(entry: IkzePlanEntry): IkzeCalculatedEntry {
  const annualLimit = Math.max(0, entry.annualLimit)
  const contributedAmount = Math.max(0, entry.contributedAmount)
  const payoutsLeft = Math.max(0, Math.floor(entry.payoutsLeft))
  const remaining = Math.max(annualLimit - contributedAmount, 0)
  const perPayout = payoutsLeft > 0 ? ceilToGrosze(remaining / payoutsLeft) : remaining

  let status: IkzePlanStatus = 'in_progress'
  if (annualLimit <= 0) status = 'missing_limit'
  else if (contributedAmount > annualLimit) status = 'over_limit'
  else if (remaining === 0) status = 'complete'

  return {
    ...entry,
    annualLimit,
    contributedAmount,
    payoutsLeft,
    remaining,
    perPayout,
    status,
  }
}

export function summarizeIkzePlans(entries: IkzePlanEntry[]): IkzeFamilySummary {
  const calculated = entries.map(calculateIkzeEntry)
  return {
    annualLimit: calculated.reduce((sum, entry) => sum + entry.annualLimit, 0),
    contributedAmount: calculated.reduce((sum, entry) => sum + entry.contributedAmount, 0),
    remaining: calculated.reduce((sum, entry) => sum + entry.remaining, 0),
    perPayout: calculated.reduce((sum, entry) => sum + entry.perPayout, 0),
  }
}

export function ikzeMonthlyContributionCost(settings: Pick<Settings, 'ikzePlans' | 'includeIkzeContributionsInCashflow'>): number {
  if (!settings.includeIkzeContributionsInCashflow) return 0
  return summarizeIkzePlans(settings.ikzePlans ?? []).perPayout
}

export function calculateProjectedIkzeRefund(entry: IkzePlanEntry, includeInCashflow: boolean): number {
  const annualLimit = Math.max(0, entry.annualLimit)
  if (annualLimit <= 0) return 0

  const contributedAmount = Math.max(0, entry.contributedAmount)
  const payoutsLeft = Math.max(0, Math.floor(entry.payoutsLeft))
  const remaining = Math.max(annualLimit - contributedAmount, 0)
  const perPayout = payoutsLeft > 0 ? ceilToGrosze(remaining / payoutsLeft) : remaining

  const projectedContributions = includeInCashflow
    ? contributedAmount + payoutsLeft * perPayout
    : contributedAmount

  const deductibleAmount = Math.min(projectedContributions, annualLimit)
  const pitRate = entry.pitRate ?? 0

  return Math.round(deductibleAmount * pitRate)
}

export function buildDefaultIkzePlans(yearMonth: string): IkzePlanEntry[] {
  const [year] = yearMonth.split('-').map(Number)
  const planYear = year || new Date().getFullYear()
  const payoutsLeft = payoutsLeftToYearEnd(yearMonth)

  const getLimit = (y: number, r: IkzeParticipantRole) => {
    return IKZE_LIMITS[y]?.[r] ?? IKZE_LIMITS[2026]?.[r] ?? 0
  }

  return [
    {
      id: `ikze-jakub-${planYear}`,
      year: planYear,
      ownerName: 'Jakub',
      role: 'entrepreneur',
      annualLimit: getLimit(planYear, 'entrepreneur'),
      contributedAmount: 0,
      payoutsLeft,
      pitRate: 0.32,
    },
    {
      id: `ikze-zona-${planYear}`,
      year: planYear,
      ownerName: 'Zona',
      role: 'employee',
      annualLimit: getLimit(planYear, 'employee'),
      contributedAmount: 0,
      payoutsLeft,
      pitRate: 0.12,
    },
  ]
}
