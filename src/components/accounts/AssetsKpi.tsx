import { TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { allSnapshotMonths, BUCKET_LABELS, sumBucketBalances, totalAssetsAsOf } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountBucket, AccountSnapshot } from '../../domain/types'
import { useStore } from '../../store'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  emergencyFundBuckets: AccountBucket[]
  safetyCushionTarget: number
  safetyCushionMonths: number
  emergencyFundTarget: number
}

export function AssetsKpi({ accounts, snapshots, emergencyFundBuckets, safetyCushionTarget, safetyCushionMonths, emergencyFundTarget }: Props) {
  const fx = useStore(s => s.settings)
  const months = allSnapshotMonths(snapshots)
  const latestMonth = months.at(-1)
  const previousMonth = months.at(-2)

  if (!latestMonth) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <EmptyKpi title="Suma majątku" />
        <EmptyKpi title="Poduszka bezpieczeństwa" />
        <EmptyKpi title="Fundusz awaryjny" />
      </div>
    )
  }

  const totalAssets = totalAssetsAsOf(accounts, snapshots, latestMonth, fx)
  const previousAssets = previousMonth ? totalAssetsAsOf(accounts, snapshots, previousMonth, fx) : undefined
  const totalDelta = previousAssets === undefined ? undefined : totalAssets - previousAssets
  // Poduszka bezpieczeństwa = konfigurowalny zestaw bucketów (docelowo ~6 mies. kosztów rodziny).
  const safetyCushion = sumBucketBalances(accounts, snapshots, latestMonth, emergencyFundBuckets, fx)
  // Fundusz awaryjny = TYLKO konta przypisane do bucketu 'emergency_fund' (mała, szybko dostępna kwota).
  const emergencyFund = sumBucketBalances(accounts, snapshots, latestMonth, ['emergency_fund'], fx)

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <KpiCard title="Suma majątku" value={formatPLN(totalAssets)} subtitle={formatYearMonth(latestMonth)} delta={totalDelta} />
      <KpiCard
        title="Poduszka bezpieczeństwa"
        value={formatPLN(safetyCushion)}
        subtitle={`${formatBucketSubtitle(emergencyFundBuckets)} · cel ${safetyCushionMonths} mies.`}
        current={safetyCushion}
        target={safetyCushionTarget}
      />
      <KpiCard
        title="Fundusz awaryjny"
        value={formatPLN(emergencyFund)}
        subtitle="Bucket: Fundusz awaryjny"
        current={emergencyFund}
        target={emergencyFundTarget}
      />
    </div>
  )
}

function formatBucketSubtitle(buckets: AccountBucket[]): string {
  if (buckets.length === 0) return 'Brak bucketów'
  return buckets.map(bucket => BUCKET_LABELS[bucket]).join(' + ')
}

function EmptyKpi({ title }: { title: string }) {
  return <KpiCard title={title} value="-" subtitle="Brak snapshotów" />
}

function KpiCard({ title, value, subtitle, delta, current, target }: { title: string; value: string; subtitle: string; delta?: number; current?: number; target?: number }) {
  const DeltaIcon = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown
  const hasProgress = target !== undefined && target > 0 && current !== undefined
  const pct = hasProgress ? Math.min(100, Math.round((current / target) * 100)) : 0
  const reached = pct >= 100

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums dark:text-gray-100">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" title={subtitle}>{subtitle}</p>
        </div>
        <div className="text-gray-400 dark:text-gray-500">
          <WalletCards size={17} />
        </div>
      </div>
      {delta !== undefined && (
        <p className={`mt-3 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          <DeltaIcon size={13} />
          {delta >= 0 ? '+' : ''}{formatPLN(delta)} m/m
        </p>
      )}
      {hasProgress && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={`h-full rounded-full ${reached ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-teal-500 dark:bg-teal-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {reached ? '✓ cel osiągnięty' : `${pct}% celu`} · {formatPLN(target)}
          </p>
        </div>
      )}
    </div>
  )
}
