import type { IkePlanEntry, IkzePlanStatus, Settings } from './types'
import { payoutsLeftToYearEnd } from './ikze'
import { projectMonthlyInvestment, BELKA_TAX_RATE } from './belka'

/*
 * IKE — Indywidualne Konto Emerytalne.
 *
 * W odróżnieniu od IKZE wpłaty NIE są odliczane od PIT (brak zwrotu podatku),
 * ale wypłata po 60. roku życia jest wolna od 19% podatku Belki od zysków.
 * Limit roczny = 3× prognozowane przeciętne wynagrodzenie miesięczne.
 */

export interface IkeCalculatedEntry extends IkePlanEntry {
  remaining: number
  perPayout: number
  status: IkzePlanStatus
}

export interface IkeFamilySummary {
  annualLimit: number
  contributedAmount: number
  remaining: number
  perPayout: number
}

export const IKE_LIMITS: Record<number, number> = {
  2024: 23472,
  2025: 26019,
  2026: 27621,
}

const ceilToGrosze = (value: number) => value <= 0 ? 0 : Math.ceil((value - Number.EPSILON) * 100) / 100

export function calculateIkeEntry(entry: IkePlanEntry): IkeCalculatedEntry {
  const annualLimit = Math.max(0, entry.annualLimit)
  const contributedAmount = Math.max(0, entry.contributedAmount)
  const payoutsLeft = Math.max(0, Math.floor(entry.payoutsLeft))
  const remaining = Math.max(annualLimit - contributedAmount, 0)
  const perPayout = payoutsLeft > 0 ? ceilToGrosze(remaining / payoutsLeft) : remaining

  let status: IkzePlanStatus = 'in_progress'
  if (annualLimit <= 0) status = 'missing_limit'
  else if (contributedAmount > annualLimit) status = 'over_limit'
  else if (remaining === 0) status = 'complete'

  return { ...entry, annualLimit, contributedAmount, payoutsLeft, remaining, perPayout, status }
}

export function summarizeIkePlans(entries: IkePlanEntry[]): IkeFamilySummary {
  const calculated = entries.map(calculateIkeEntry)
  return {
    annualLimit: calculated.reduce((sum, entry) => sum + entry.annualLimit, 0),
    contributedAmount: calculated.reduce((sum, entry) => sum + entry.contributedAmount, 0),
    remaining: calculated.reduce((sum, entry) => sum + entry.remaining, 0),
    perPayout: calculated.reduce((sum, entry) => sum + entry.perPayout, 0),
  }
}

export function ikeMonthlyContributionCost(settings: Pick<Settings, 'ikePlans' | 'includeIkeContributionsInCashflow'>): number {
  if (!settings.includeIkeContributionsInCashflow) return 0
  return summarizeIkePlans(settings.ikePlans ?? []).perPayout
}

/**
 * Korzyść podatkowa IKE: ile podatku Belki unikniesz, wpłacając `monthly`
 * przez `years` lat przy `annualReturnPct`% rocznie — vs zwykłe konto maklerskie.
 */
export function projectIkeTaxFreeBenefit(monthly: number, years: number, annualReturnPct: number): number {
  const taxable = projectMonthlyInvestment(monthly, years, annualReturnPct, BELKA_TAX_RATE)
  return taxable.taxPaid
}

export function buildDefaultIkePlans(yearMonth: string): IkePlanEntry[] {
  const [year] = yearMonth.split('-').map(Number)
  const planYear = year || new Date().getFullYear()
  const payoutsLeft = payoutsLeftToYearEnd(yearMonth)
  const limit = IKE_LIMITS[planYear] ?? IKE_LIMITS[2026] ?? 0

  return [
    {
      id: `ike-jakub-${planYear}`,
      year: planYear,
      ownerName: 'Jakub',
      annualLimit: limit,
      contributedAmount: 0,
      payoutsLeft,
    },
    {
      id: `ike-zona-${planYear}`,
      year: planYear,
      ownerName: 'Zona',
      annualLimit: limit,
      contributedAmount: 0,
      payoutsLeft,
    },
  ]
}
