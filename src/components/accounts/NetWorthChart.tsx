import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { allSnapshotMonths, totalAssetsAsOf } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountSnapshot, Loan, MortgagePlan } from '../../domain/types'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  loans: Loan[]
  mortgagePlan?: MortgagePlan
}

interface ChartPoint {
  label: string
  assets: number
  netWorth: number
  debt: number
}

export function NetWorthChart({ accounts, snapshots, loans, mortgagePlan }: Props) {
  const data = useMemo<ChartPoint[]>(() => {
    const debt = currentDebt(loans, mortgagePlan)

    return allSnapshotMonths(snapshots).map(yearMonth => {
      const assets = totalAssetsAsOf(accounts, snapshots, yearMonth)
      return {
        label: formatYearMonth(yearMonth),
        assets,
        netWorth: assets - debt,
        debt,
      }
    })
  }, [accounts, snapshots, loans, mortgagePlan])

  if (data.length === 0) {
    return null
  }

  const tickInterval = Math.max(1, Math.floor(data.length / 12))
  const hasDebt = data.some(point => point.debt > 0)

  return (
    <div className="space-y-2">
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="assets-net-worth-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval - 1} className="fill-gray-500" />
            <YAxis
              tickFormatter={v => `${Math.round(Number(v) / 1000)}k`}
              tick={{ fontSize: 11 }}
              width={44}
              className="fill-gray-500"
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const labels: Record<string, string> = {
                  assets: 'Suma majątku',
                  netWorth: 'Net worth netto',
                  debt: 'Dług bieżący',
                }
                return [formatPLN(value), labels[String(name)] ?? String(name)]
              }}
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
            <Legend
              formatter={(value: string) => ({
                assets: 'Suma majątku',
                netWorth: 'Net worth netto',
                debt: 'Dług bieżący',
              })[value] ?? value}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey="assets"
              stroke="#2563eb"
              fill="url(#assets-net-worth-gradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {hasDebt && (
              <Line
                type="monotone"
                dataKey="debt"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Dług jest odejmowany read-only jako bieżące saldo kredytów i hipoteki na całej historii, bo EPIC 1 nie zapisuje historii zadłużenia.
      </p>
    </div>
  )
}

function currentDebt(loans: Loan[], mortgagePlan?: MortgagePlan): number {
  const simpleLoans = loans.reduce((sum, loan) => sum + loan.remainingBalance, 0)
  return simpleLoans + (mortgagePlan?.principal ?? 0)
}
