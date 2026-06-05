import { describe, expect, it } from 'vitest'
import { buildNextBestAction } from './nextBestAction'
import type { NextCycleForecast } from './nextCycleForecast'
import type { SecurityBuffersModel } from './securityBuffers'
import type { Goal, Settings } from './types'

const settings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: '2026-06',
  horizonMonths: 12,
  emergencyFundBuckets: ['safety_cushion'],
}

const forecast = (freeCashAfterCreditCard: number): NextCycleForecast => ({
  currentMonth: '2026-06',
  targetMonth: '2026-07',
  income: 10000,
  totalRequired: 6000,
  freeCashBeforeCreditCard: freeCashAfterCreditCard,
  freeCashAfterCreditCard,
  creditCardPayment: 0,
  lines: [],
})

const security = (missing = 0): SecurityBuffersModel => ({
  latestMonth: '2026-06',
  monthlyCostBasis: 6000,
  allMet: missing === 0,
  missingBuffers: missing > 0
    ? [{
        id: 'emergency_fund',
        goalId: 'security:emergency_fund',
        title: 'Fundusz awaryjny',
        current: 7000,
        target: 10000,
        missing,
        progressPct: 70,
        status: 'missing',
        priority: 1,
        latestMonth: '2026-06',
        detail: 'Bucket: Fundusz awaryjny',
        focusCopy: 'Najpierw szybki bufor.',
      }]
    : [],
  buffers: [],
})

const goals: Goal[] = [
  { id: 'vacation', name: 'Wakacje', targetAmount: 8000, currentSaved: 3000, priority: 2 },
]

describe('buildNextBestAction', () => {
  it('covers the next-cycle deficit before recommending savings', () => {
    const action = buildNextBestAction({
      forecast: forecast(-1200),
      security: security(3000),
      settings,
      goals,
    })

    expect(action.kind).toBe('cover_deficit')
    expect(action.amount).toBe(1200)
    expect(action.confidence).toBe('high')
  })

  it('tops up the missing security buffer before IKZE and manual goals', () => {
    const action = buildNextBestAction({
      forecast: forecast(2200),
      security: security(3000),
      settings: {
        ...settings,
        ikzePlans: [{
          id: 'ikze-jakub-2026',
          year: 2026,
          ownerName: 'Jakub',
          role: 'entrepreneur',
          annualLimit: 12000,
          contributedAmount: 6000,
          payoutsLeft: 6,
        }],
      },
      goals,
    })

    expect(action.kind).toBe('top_up_security_buffer')
    expect(action.amount).toBe(2200)
    expect(action.targetName).toBe('Fundusz awaryjny')
  })

  it('recommends IKZE after security is met', () => {
    const action = buildNextBestAction({
      forecast: forecast(2500),
      security: security(0),
      settings: {
        ...settings,
        ikzePlans: [{
          id: 'ikze-jakub-2026',
          year: 2026,
          ownerName: 'Jakub',
          role: 'entrepreneur',
          annualLimit: 12000,
          contributedAmount: 6000,
          payoutsLeft: 6,
        }],
      },
      goals,
    })

    expect(action.kind).toBe('fund_ikze')
    expect(action.amount).toBe(1000)
  })

  it('funds the highest-priority incomplete manual goal when safety and IKZE are done', () => {
    const action = buildNextBestAction({
      forecast: forecast(2500),
      security: security(0),
      settings,
      goals,
    })

    expect(action.kind).toBe('fund_goal')
    expect(action.amount).toBe(2500)
    expect(action.targetName).toBe('Wakacje')
  })

  it('keeps the surplus available when account snapshots are missing', () => {
    const action = buildNextBestAction({
      forecast: forecast(2500),
      security: {
        ...security(0),
        latestMonth: undefined,
        allMet: false,
      },
      settings,
      goals,
    })

    expect(action.kind).toBe('hold_surplus')
    expect(action.confidence).toBe('low')
    expect(action.reasons[0]).toContain('snapshot')
  })

  it('keeps surplus available when no target needs money', () => {
    const action = buildNextBestAction({
      forecast: forecast(1500),
      security: security(0),
      settings,
      goals: [{ ...goals[0], currentSaved: 8000 }],
    })

    expect(action.kind).toBe('hold_surplus')
    expect(action.amount).toBe(1500)
  })
})
