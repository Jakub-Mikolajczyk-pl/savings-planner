import { memo, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { balanceAsOf, isActiveInMonth } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountSnapshot } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  months: string[]
  onSetSnapshot: (accountId: string, yearMonth: string, balance: number) => void
  onRemoveSnapshot: (accountId: string, yearMonth: string) => void
}

export function AccountsTable({ accounts, snapshots, months, onSetSnapshot, onRemoveSnapshot }: Props) {
  const snapshotsByCell = useMemo(() => {
    const map = new Map<string, AccountSnapshot>()
    snapshots.forEach(snapshot => {
      map.set(`${snapshot.accountId}:${snapshot.yearMonth}`, snapshot)
    })
    return map
  }, [snapshots])

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
}

const AccountsTableRow = memo(function AccountsTableRow({
  yearMonth,
  accounts,
  snapshots,
  snapshotsByCell,
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
          </td>
        )
      })}
    </tr>
  )
})
