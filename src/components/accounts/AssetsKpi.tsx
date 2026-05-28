import { TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { allSnapshotMonths, balanceAsOf, totalAssetsAsOf } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountSnapshot, AccountBucket } from '../../domain/types'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  emergencyFundBuckets: AccountBucket[]
}

export function AssetsKpi({ accounts, snapshots, emergencyFundBuckets }: Props) {
  const months = allSnapshotMonths(snapshots)
  const latestMonth = months.at(-1)
  const previousMonth = months.at(-2)

  if (!latestMonth) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <EmptyKpi title="Suma majątku" />
        <EmptyKpi title="Fundusz awaryjny" />
        <EmptyKpi title="Wkład własny" />
      </div>
    )
  }

  const totalAssets = totalAssetsAsOf(accounts, snapshots, latestMonth)
  const previousAssets = previousMonth ? totalAssetsAsOf(accounts, snapshots, previousMonth) : undefined
  const totalDelta = previousAssets === undefined ? undefined : totalAssets - previousAssets

  const emergencyFund = sumBuckets(accounts, snapshots, latestMonth, emergencyFundBuckets)
  const downPayment = sumBuckets(accounts, snapshots, latestMonth, ['down_payment'])

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <KpiCard title="Suma majątku" value={formatPLN(totalAssets)} subtitle={formatYearMonth(latestMonth)} delta={totalDelta} />
      <KpiCard title="Fundusz awaryjny" value={formatPLN(emergencyFund)} subtitle={emergencyFundBuckets.length > 0 ? 'Wybrane buckety' : 'Brak bucketów'} />
      <KpiCard title="Wkład własny" value={formatPLN(downPayment)} subtitle="Bucket: wkład własny" />
    </div>
  )
}

function sumBuckets(accounts: Account[], snapshots: AccountSnapshot[], yearMonth: string, buckets: AccountBucket[]): number {
  return accounts
    .filter(account => buckets.includes(account.bucket))
    .reduce((total, account) => total + balanceAsOf(snapshots, account, yearMonth), 0)
}

function EmptyKpi({ title }: { title: string }) {
  return <KpiCard title={title} value="—" subtitle="Brak snapshotów" />
}

function KpiCard({ title, value, subtitle, delta }: { title: string; value: string; subtitle: string; delta?: number }) {
  const DeltaIcon = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">
          <WalletCards size={17} />
        </div>
      </div>
      {delta !== undefined && (
        <p className={`mt-3 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          <DeltaIcon size={13} />
          {delta >= 0 ? '+' : ''}{formatPLN(delta)} m/m
        </p>
      )}
    </div>
  )
}
