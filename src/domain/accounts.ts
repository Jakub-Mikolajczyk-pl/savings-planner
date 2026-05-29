import type { Account, AccountBucket, AccountSnapshot } from './types'

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

export function totalAssetsAsOf(accounts: Account[], snapshots: AccountSnapshot[], yearMonth: string): number {
  return accounts.reduce((total, account) => total + balanceAsOf(snapshots, account, yearMonth), 0)
}
