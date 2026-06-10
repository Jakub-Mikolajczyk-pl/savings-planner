import type { PpkSettings, Settings } from './types'

/*
 * PPK — Pracownicze Plany Kapitałowe.
 *
 * Składka pracownika (standard 2% brutto) schodzi z wypłaty, pracodawca dokłada
 * 1,5% brutto, a państwo dopłaca 240 zł rocznie (+ jednorazowe 250 zł powitalne).
 * Pieniądze lądują na rachunku inwestycyjnym należącym do pracownika, więc
 * traktujemy je jako osobno rosnące aktywo emerytalne, nie jako czysty koszt.
 */

export const PPK_DEFAULTS: PpkSettings = {
  enabled: false,
  grossMonthlySalary: 0,
  employeePct: 2.0,
  employerPct: 1.5,
  currentBalance: 0,
  annualStateBonus: 240,
  includeInCashflow: false,
}

export interface PpkMonthlyBreakdown {
  employee: number // potrącane z pensji
  employer: number // dokładane przez pracodawcę
  state: number // 1/12 dopłaty rocznej
  total: number // miesięczny przyrost rachunku PPK
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function ppkMonthlyBreakdown(ppk: PpkSettings | undefined): PpkMonthlyBreakdown {
  if (!ppk?.enabled || ppk.grossMonthlySalary <= 0) {
    return { employee: 0, employer: 0, state: 0, total: 0 }
  }
  const employee = round2(ppk.grossMonthlySalary * Math.max(0, ppk.employeePct) / 100)
  const employer = round2(ppk.grossMonthlySalary * Math.max(0, ppk.employerPct) / 100)
  const state = round2(Math.max(0, ppk.annualStateBonus) / 12)
  return { employee, employer, state, total: round2(employee + employer + state) }
}

/** Składka pracownika jako miesięczny koszt cashflow (0, gdy wyłączone lub nie wliczane). */
export function ppkMonthlyEmployeeCost(settings: Pick<Settings, 'ppk'>): number {
  const ppk = settings.ppk
  if (!ppk?.enabled || !ppk.includeInCashflow) return 0
  return ppkMonthlyBreakdown(ppk).employee
}

/** Projekcja salda PPK po `years` latach przy `annualReturnPct`% rocznie (bez podatku w fazie akumulacji). */
export function projectPpkBalance(ppk: PpkSettings | undefined, years: number, annualReturnPct: number): number {
  const breakdown = ppkMonthlyBreakdown(ppk)
  if (!ppk?.enabled) return 0
  const months = Math.max(0, Math.round(years * 12))
  const monthlyRate = annualReturnPct / 100 / 12
  let balance = Math.max(0, ppk.currentBalance)
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + breakdown.total
  }
  return round2(balance)
}
