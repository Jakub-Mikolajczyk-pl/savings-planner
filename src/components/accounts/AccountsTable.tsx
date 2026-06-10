import { memo, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { balanceAsOf, isActiveInMonth, totalAssetsAsOf } from '../../domain/accounts'
import { convertToBase, fxRateToBase, type FxSettings } from '../../domain/fx'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountSnapshot } from '../../domain/types'
import { useStore } from '../../store'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  months: string[]
  onSetSnapshot: (accountId: string, yearMonth: string, balance: number) => void
  onRemoveSnapshot: (accountId: string, yearMonth: string) => void
}

export function AccountsTable({ accounts, snapshots, months, onSetSnapshot, onRemoveSnapshot }: Props) {
  const fx = useStore(s => s.settings)
  const snapshotsByCell = useMemo(() => {
    const map = new Map<string, AccountSnapshot>()
    snapshots.forEach(snapshot => {
      map.set(`${snapshot.accountId}:${snapshot.yearMonth}`, snapshot)
    })
    return map
  }, [snapshots])

  // Suma majątku per miesiąc + zmiana m/m (liczone chronologicznie, niezależnie od kolejności wyświetlania).
  const monthTotals = useMemo(() => {
    const map = new Map<string, { total: number; delta?: number }>()
    let previous: number | undefined
    ;[...months].sort().forEach(yearMonth => {
      const total = totalAssetsAsOf(accounts, snapshots, yearMonth, fx)
      map.set(yearMonth, { total, delta: previous === undefined ? undefined : total - previous })
      previous = total
    })
    return map
  }, [accounts, snapshots, months, fx])

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400">
        Dodaj pierwsze konto, a tabela stanów pojawi się tutaj.
      </div>
    )
  }

  if (months.length === 0) {
    return (
      <div className="px-4 py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400">
        Dodaj miesiąc i wpisz pierwsze saldo, żeby rozpocząć historię.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 min-w-36">
              Miesiąc
            </th>
            {accounts.map(account => (
              <th key={account.id} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 min-w-48">
                <span className="block truncate">{account.name}</span>
                <span className="block normal-case font-normal text-gray-400">{account.currency}</span>
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-gray-50 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400 min-w-36">
              Suma majątku
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {months.map(yearMonth => (
            <AccountsTableRow
              key={yearMonth}
              yearMonth={yearMonth}
              accounts={accounts}
              snapshots={snapshots}
              snapshotsByCell={snapshotsByCell}
              total={monthTotals.get(yearMonth)?.total ?? 0}
              delta={monthTotals.get(yearMonth)?.delta}
              fx={fx}
              onSetSnapshot={onSetSnapshot}
              onRemoveSnapshot={onRemoveSnapshot}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps extends Omit<Props, 'months'> {
  yearMonth: string
  snapshotsByCell: Map<string, AccountSnapshot>
  total: number
  delta?: number
  fx: FxSettings
}

const AccountsTableRow = memo(function AccountsTableRow({
  yearMonth,
  accounts,
  snapshots,
  snapshotsByCell,
  total,
  delta,
  fx,
  onSetSnapshot,
  onRemoveSnapshot,
}: RowProps) {
  return (
    <tr>
      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-3 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
        <span className="block">{formatYearMonth(yearMonth)}</span>
        <span className="text-xs font-normal text-gray-400">{yearMonth}</span>
      </td>
      {accounts.map(account => {
        const active = isActiveInMonth(account, yearMonth)
        const snapshot = snapshotsByCell.get(`${account.id}:${yearMonth}`)
        const carryForward = balanceAsOf(snapshots, account, yearMonth)

        if (!active) {
          return (
            <td key={account.id} className="px-3 py-3 text-xs text-gray-300 dark:text-gray-700">
              poza zakresem
            </td>
          )
        }

        return (
          <td key={account.id} className="px-3 py-2 align-top">
            <div className="flex items-start gap-2">
              <CurrencyInput
                value={snapshot?.balance ?? 0}
                onChange={value => onSetSnapshot(account.id, yearMonth, value)}
                placeholder={snapshot ? '0' : '—'}
                className="min-w-32"
              />
              {snapshot && (
                <button
                  onClick={() => onRemoveSnapshot(account.id, yearMonth)}
                  className="mt-1.5 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  aria-label="Usuń snapshot"
                  title="Usuń snapshot"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {!snapshot && carryForward > 0 && (
              <p className="mt-1 text-xs text-gray-400">carry-forward: {formatPLN(carryForward)}</p>
            )}
            {fxRateToBase(account.currency, fx) !== 1 && (snapshot?.balance ?? carryForward) > 0 && (
              <p className="mt-1 text-xs tabular-nums text-sky-600 dark:text-sky-400">
                ≈ {formatPLN(convertToBase(snapshot?.balance ?? carryForward, account.currency, fx))}
              </p>
            )}
          </td>
        )
      })}
      <td className="sticky right-0 z-10 bg-white px-3 py-3 text-right align-top whitespace-nowrap dark:bg-gray-900">
        <span className="block font-display text-base font-semibold tnum text-teal-700 dark:text-teal-300">{formatPLN(total)}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`mt-0.5 block text-xs tnum ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {delta > 0 ? '+' : '−'}{formatPLN(Math.abs(delta))} m/m
          </span>
        )}
      </td>
    </tr>
  )
})
