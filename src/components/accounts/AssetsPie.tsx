import { useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { allSnapshotMonths, balanceAsOf, BUCKET_LABELS, isActiveInMonth } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountBucket, AccountSnapshot } from '../../domain/types'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
}

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#dc2626']

export function AssetsPie({ accounts, snapshots }: Props) {
  const [mode, setMode] = useState<'bucket' | 'account'>('bucket')
  const latestMonth = allSnapshotMonths(snapshots).at(-1)

  const data = useMemo(() => {
    if (!latestMonth) return []

    const activeBalances = accounts
      .filter(account => isActiveInMonth(account, latestMonth))
      .map(account => ({
        account,
        balance: balanceAsOf(snapshots, account, latestMonth),
      }))
      .filter(item => item.balance > 0)

    if (mode === 'account') {
      return activeBalances.map(({ account, balance }) => ({
        key: account.id,
        name: account.name,
        value: balance,
      }))
    }

    const byBucket = new Map<AccountBucket, number>()
    activeBalances.forEach(({ account, balance }) => {
      byBucket.set(account.bucket, (byBucket.get(account.bucket) ?? 0) + balance)
    })

    return [...byBucket.entries()].map(([bucket, value]) => ({
      key: bucket,
      name: BUCKET_LABELS[bucket],
      value,
    }))
  }, [accounts, latestMonth, mode, snapshots])

  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (!latestMonth || total <= 0) return null

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Struktura majątku</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">{formatYearMonth(latestMonth)} · suma {formatPLN(total)}</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 text-xs">
          <button
            onClick={() => setMode('bucket')}
            className={`px-3 py-1.5 rounded-md transition-colors ${mode === 'bucket' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-950' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Buckety
          </button>
          <button
            onClick={() => setMode('account')}
            className={`px-3 py-1.5 rounded-md transition-colors ${mode === 'account' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-950' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Konta
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={92}
              paddingAngle={2}
              label={renderLabel}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.key} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const numeric = Number(value ?? 0)
                const percent = total > 0 ? (numeric / total) * 100 : 0
                return [`${formatPLN(numeric)} (${percent.toFixed(1)}%)`, String(name)]
              }}
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function renderLabel(slice: unknown) {
  const percent = typeof slice === 'object' && slice !== null && 'percent' in slice
    ? Number(slice.percent ?? 0)
    : 0
  if (percent < 0.04) return ''
  return `${(percent * 100).toFixed(0)}%`
}
