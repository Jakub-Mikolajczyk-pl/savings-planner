import { describe, expect, it } from 'vitest'
import { convertToBase, currenciesForRateEditor, fxRateToBase, hasKnownRate } from './fx'
import { convertedBalanceAsOf, sumBucketBalances, totalAssetsAsOf } from './accounts'
import type { Account, AccountSnapshot } from './types'

const account = (id: string, currency: string, bucket: Account['bucket'] = 'accounts'): Account => ({
  id,
  name: id,
  bucket,
  currency,
})

describe('fxRateToBase', () => {
  it('returns 1 for the base currency', () => {
    expect(fxRateToBase('PLN')).toBe(1)
    expect(fxRateToBase(undefined)).toBe(1)
  })

  it('uses the manual override when provided', () => {
    expect(fxRateToBase('EUR', { fxRates: { EUR: 4.5 } })).toBe(4.5)
  })

  it('falls back to default rates without an override', () => {
    expect(fxRateToBase('EUR')).toBeGreaterThan(1)
    expect(fxRateToBase('USD', { fxRates: {} })).toBeGreaterThan(1)
  })

  it('falls back to 1 for an unknown currency', () => {
    expect(fxRateToBase('XYZ')).toBe(1)
    expect(hasKnownRate('XYZ')).toBe(false)
    expect(hasKnownRate('EUR')).toBe(true)
  })

  it('ignores non-positive overrides', () => {
    expect(fxRateToBase('EUR', { fxRates: { EUR: 0 } })).toBeGreaterThan(1)
  })
})

describe('convertToBase', () => {
  it('multiplies and rounds to grosze', () => {
    expect(convertToBase(100, 'EUR', { fxRates: { EUR: 4.333 } })).toBe(433.3)
    expect(convertToBase(100, 'PLN')).toBe(100)
  })
})

describe('multi-currency asset totals', () => {
  const accounts = [account('pln', 'PLN'), account('eur', 'EUR', 'investments')]
  const snapshots: AccountSnapshot[] = [
    { accountId: 'pln', yearMonth: '2026-01', balance: 1000 },
    { accountId: 'eur', yearMonth: '2026-01', balance: 100 },
  ]
  const fx = { fxRates: { EUR: 4.5 } }

  it('converts foreign balances in totalAssetsAsOf', () => {
    expect(totalAssetsAsOf(accounts, snapshots, '2026-01', fx)).toBe(1450)
  })

  it('converts a single account balance', () => {
    expect(convertedBalanceAsOf(snapshots, accounts[1], '2026-01', fx)).toBe(450)
  })

  it('converts bucket sums', () => {
    expect(sumBucketBalances(accounts, snapshots, '2026-01', ['investments'], fx)).toBe(450)
    expect(sumBucketBalances(accounts, snapshots, '2026-01', ['accounts'], fx)).toBe(1000)
  })
})

describe('currenciesForRateEditor', () => {
  it('merges common currencies with account currencies, excluding base', () => {
    const list = currenciesForRateEditor([account('a', 'PLN'), account('b', 'NOK')])
    expect(list).toContain('NOK')
    expect(list).toContain('EUR')
    expect(list).not.toContain('PLN')
  })
})
