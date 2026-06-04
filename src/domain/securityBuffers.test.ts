import { describe, expect, it } from 'vitest'
import { buildSecurityBuffers, committedMonthlyCostBasis } from './securityBuffers'
import type { Account, AccountSnapshot, Schedule, Settings } from './types'

const settings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 5000,
  startMonth: '2026-01',
  horizonMonths: 12,
  emergencyFundBuckets: ['safety_cushion', 'accounts'],
  safetyCushionMonths: 6,
  emergencyFundTarget: 10000,
}

const accounts: Account[] = [
  { id: 'main', name: 'Main', bucket: 'accounts', currency: 'PLN' },
  { id: 'safe', name: 'Safe', bucket: 'safety_cushion', currency: 'PLN' },
  { id: 'emergency', name: 'Emergency', bucket: 'emergency_fund', currency: 'PLN' },
]

const snapshots: AccountSnapshot[] = [
  { accountId: 'main', yearMonth: '2026-01', balance: 2000 },
  { accountId: 'safe', yearMonth: '2026-01', balance: 18000 },
  { accountId: 'emergency', yearMonth: '2026-01', balance: 7000 },
]

describe('security buffers', () => {
  it('uses the same committed monthly cost basis as assets KPIs', () => {
    const schedule = {
      rows: [
        {
          expenses: 6000,
          subscriptionsTotal: 500,
          loanPaymentsTotal: 800,
          mortgagePaymentTotal: 2500,
        },
      ],
    } as Schedule

    expect(committedMonthlyCostBasis(settings, schedule)).toBe(9800)
  })

  it('builds safety cushion and emergency fund targets from snapshots and settings', () => {
    const model = buildSecurityBuffers(settings, accounts, snapshots)

    expect(model.latestMonth).toBe('2026-01')
    expect(model.buffers.find(buffer => buffer.id === 'emergency_fund')).toMatchObject({
      current: 7000,
      target: 10000,
      missing: 3000,
      status: 'missing',
      priority: 1,
    })
    expect(model.buffers.find(buffer => buffer.id === 'safety_cushion')).toMatchObject({
      current: 20000,
      target: 30000,
      missing: 10000,
      status: 'missing',
      priority: 1,
    })
  })
})
