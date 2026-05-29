import { describe, expect, it } from 'vitest'
import { allSnapshotMonths, balanceAsOf, isActiveInMonth, totalAssetsAsOf } from './accounts'
import type { Account, AccountSnapshot } from './types'

const makeAccount = (overrides: Partial<Account> & { id: string }): Account => ({
  name: 'Konto',
  bucket: 'accounts',
  currency: 'PLN',
  ...overrides,
})

describe('accounts domain', () => {
  it('carries balance forward from the latest earlier snapshot', () => {
    const account = makeAccount({ id: 'a1' })
    const snapshots: AccountSnapshot[] = [
      { accountId: 'a1', yearMonth: '2024-01', balance: 1000 },
      { accountId: 'a1', yearMonth: '2024-03', balance: 1500 },
    ]

    expect(balanceAsOf(snapshots, account, '2024-02')).toBe(1000)
    expect(balanceAsOf(snapshots, account, '2024-04')).toBe(1500)
  })

  it('returns zero after closedAt', () => {
    const account = makeAccount({ id: 'a1', closedAt: '2024-03' })
    const snapshots: AccountSnapshot[] = [
      { accountId: 'a1', yearMonth: '2024-03', balance: 1500 },
    ]

    expect(balanceAsOf(snapshots, account, '2024-03')).toBe(1500)
    expect(balanceAsOf(snapshots, account, '2024-04')).toBe(0)
  })

  it('checks lifecycle boundaries inclusively', () => {
    const account = makeAccount({ id: 'a1', openedAt: '2024-02', closedAt: '2024-04' })

    expect(isActiveInMonth(account, '2024-01')).toBe(false)
    expect(isActiveInMonth(account, '2024-02')).toBe(true)
    expect(isActiveInMonth(account, '2024-04')).toBe(true)
    expect(isActiveInMonth(account, '2024-05')).toBe(false)
  })

  it('sums many accounts with gaps using carry-forward', () => {
    const accounts: Account[] = [
      makeAccount({ id: 'cash' }),
      makeAccount({ id: 'brokerage', bucket: 'investments' }),
      makeAccount({ id: 'closed', closedAt: '2024-02' }),
    ]
    const snapshots: AccountSnapshot[] = [
      { accountId: 'cash', yearMonth: '2024-01', balance: 1000 },
      { accountId: 'brokerage', yearMonth: '2024-02', balance: 5000 },
      { accountId: 'closed', yearMonth: '2024-02', balance: 300 },
    ]

    expect(totalAssetsAsOf(accounts, snapshots, '2024-03')).toBe(6000)
  })

  it('sorts and deduplicates snapshot months', () => {
    const snapshots: AccountSnapshot[] = [
      { accountId: 'a1', yearMonth: '2024-03', balance: 1 },
      { accountId: 'a2', yearMonth: '2024-01', balance: 2 },
      { accountId: 'a1', yearMonth: '2024-03', balance: 3 },
      { accountId: 'a3', yearMonth: '2024-02', balance: 4 },
    ]

    expect(allSnapshotMonths(snapshots)).toEqual(['2024-01', '2024-02', '2024-03'])
  })
})
