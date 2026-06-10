import { describe, expect, it } from 'vitest'
import { buildReconciliationRows } from './reconciliation'
import type { MonthlyActuals, Settings } from './types'

const settings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: '2026-06',
  horizonMonths: 12,
  emergencyFundBuckets: ['safety_cushion'],
}

const actual = (yearMonth: string, patch: Partial<MonthlyActuals> = {}): MonthlyActuals => ({
  yearMonth,
  income: 10000,
  expense: 6000,
  savingsContribution: 0,
  savingsWithdrawal: 0,
  uncategorizedCount: 0,
  transactionCount: 40,
  ...patch,
})

const build = (actuals: MonthlyActuals[]) =>
  buildReconciliationRows(settings, [], [], {}, undefined, [], [], actuals)

describe('buildReconciliationRows', () => {
  it('returns nothing without actuals', () => {
    expect(build([])).toEqual([])
  })

  it('marks a month on plan as ok with ~0% drift', () => {
    const [row] = build([actual('2026-04')])
    expect(row.income.driftPct).toBe(0)
    expect(row.income.level).toBe('ok')
    expect(row.expenses.driftPct).toBe(0)
    expect(row.expenses.level).toBe('ok')
  })

  it('flags overspending and missing income asymmetrically', () => {
    const [row] = build([actual('2026-04', { expense: 7800, income: 8500 })])
    // wydatki +30% => alert
    expect(row.expenses.driftPct).toBe(30)
    expect(row.expenses.level).toBe('alert')
    // przychody -15% => warn (niedowiezienie jest złe)
    expect(row.income.driftPct).toBe(-15)
    expect(row.income.level).toBe('warn')
  })

  it('does not punish exceeding the plan in the good direction', () => {
    const [row] = build([actual('2026-04', { income: 13000, expense: 4000 })])
    expect(row.income.level).toBe('ok') // +30% przychodów to nie problem
    expect(row.expenses.level).toBe('ok') // -33% wydatków to nie problem
  })

  it('uses month overrides from the plan engine', () => {
    const rows = buildReconciliationRows(
      settings, [], [], { '2026-04': { income: 14000 } }, undefined, [], [],
      [actual('2026-04', { income: 14000 })],
    )
    expect(rows[0].income.planned).toBe(14000)
    expect(rows[0].income.driftPct).toBe(0)
  })

  it('nets savings withdrawals against contributions', () => {
    const [row] = build([actual('2026-04', { savingsContribution: 2000, savingsWithdrawal: 500 })])
    expect(row.savings.actual).toBe(1500)
  })

  it('sorts rows chronologically and reports uncategorized count', () => {
    const rows = build([
      actual('2026-05', { uncategorizedCount: 7 }),
      actual('2026-04'),
    ])
    expect(rows.map(r => r.yearMonth)).toEqual(['2026-04', '2026-05'])
    expect(rows[1].uncategorizedCount).toBe(7)
  })
})
