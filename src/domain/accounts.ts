import type { Account, AccountBucket, AccountSnapshot } from './types'
import { convertToBase, type FxSettings } from './fx'

export const ACCOUNT_BUCKETS: AccountBucket[] = [
  'accounts',
  'safety_cushion',
  'retirement',
  'renovation',
  'investments',
  'vacation',
  'emergency_fund',
]

export const BUCKET_LABELS: Record<AccountBucket, string> = {
  accounts: 'Konta',
  safety_cushion: 'Poduszka bezpieczeństwa',
  retirement: 'Emerytalne',
  renovation: 'Remont',
  investments: 'Inwestycje',
  vacation: 'Wakacje',
  emergency_fund: 'Fundusz awaryjny',
}

// Domyślny bucket dla nowych/importowanych kont, gdy nic nie wybrano.
export const DEFAULT_BUCKET: AccountBucket = 'accounts'

export function isActiveInMonth(account: Account, yearMonth: string): boolean {
  if (account.openedAt && yearMonth < account.openedAt) return false
  if (account.closedAt && yearMonth > account.closedAt) return false
  return true
}

export function balanceAsOf(snapshots: AccountSnapshot[], account: Account, yearMonth: string): number {
  if (account.closedAt && yearMonth > account.closedAt) return 0

  const latest = snapshots
    .filter(s => s.accountId === account.id && s.yearMonth <= yearMonth)
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]

  return latest?.balance ?? 0
}

export function latestSnapshotMonth(snapshots: AccountSnapshot[], accountId: string): string | undefined {
  return snapshots
    .filter(s => s.accountId === accountId)
    .map(s => s.yearMonth)
    .sort((a, b) => b.localeCompare(a))[0]
}

export function earliestSnapshotMonth(snapshots: AccountSnapshot[], accountId: string): string | undefined {
  return snapshots
    .filter(s => s.accountId === accountId)
    .map(s => s.yearMonth)
    .sort()[0]
}

export function allSnapshotMonths(snapshots: AccountSnapshot[]): string[] {
  return [...new Set(snapshots.map(s => s.yearMonth))].sort()
}

/** Saldo konta przeliczone na walutę bazową (PLN) po kursie z ustawień. */
export function convertedBalanceAsOf(
  snapshots: AccountSnapshot[],
  account: Account,
  yearMonth: string,
  fx?: FxSettings,
): number {
  return convertToBase(balanceAsOf(snapshots, account, yearMonth), account.currency, fx)
}

export function totalAssetsAsOf(
  accounts: Account[],
  snapshots: AccountSnapshot[],
  yearMonth: string,
  fx?: FxSettings,
): number {
  return accounts.reduce((total, account) => total + convertedBalanceAsOf(snapshots, account, yearMonth, fx), 0)
}

/** Suma sald (w walucie bazowej) kont należących do wskazanych bucketów. */
export function sumBucketBalances(
  accounts: Account[],
  snapshots: AccountSnapshot[],
  yearMonth: string,
  buckets: AccountBucket[],
  fx?: FxSettings,
): number {
  return accounts
    .filter(account => buckets.includes(account.bucket))
    .reduce((total, account) => total + convertedBalanceAsOf(snapshots, account, yearMonth, fx), 0)
}
