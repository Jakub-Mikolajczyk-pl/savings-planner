import { AlertTriangle, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { balanceAsOf, isActiveInMonth } from '../../domain/accounts'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Account, AccountSnapshot } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

export interface SnapshotMonthValue {
  accountId: string
  yearMonth: string
  balance: number
}

interface SnapshotMonthDialogProps {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  yearMonth: string
  onSave: (values: SnapshotMonthValue[]) => void
  onCancel: () => void
}

export function SnapshotMonthDialog({
  accounts,
  snapshots,
  yearMonth,
  onSave,
  onCancel,
}: SnapshotMonthDialogProps) {
  const activeAccounts = useMemo(
    () => accounts.filter(account => isActiveInMonth(account, yearMonth)),
    [accounts, yearMonth],
  )

  const initialBalances = useMemo(() => {
    return Object.fromEntries(
      activeAccounts.map(account => {
        const explicit = snapshots.find(snapshot => snapshot.accountId === account.id && snapshot.yearMonth === yearMonth)
        return [account.id, explicit?.balance ?? balanceAsOf(snapshots, account, yearMonth)]
      }),
    )
  }, [activeAccounts, snapshots, yearMonth])

  const [balances, setBalances] = useState<Record<string, number>>(initialBalances)

  const handleSave = () => {
    onSave(activeAccounts.map(account => ({
      accountId: account.id,
      yearMonth,
      balance: balances[account.id] ?? 0,
    })))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-month-title"
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 id="snapshot-month-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Salda kont za {formatYearMonth(yearMonth)}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Wpisz stany aktywnych kont bez przewijania szerokiej tabeli.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            aria-label="Zamknij"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {activeAccounts.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Brak aktywnych kont w tym miesiącu.
            </div>
          ) : (
            <div className="space-y-2">
              {activeAccounts.map(account => {
                const carryForward = balanceAsOf(snapshots, account, yearMonth)
                const hasSnapshot = snapshots.some(snapshot => snapshot.accountId === account.id && snapshot.yearMonth === yearMonth)

                return (
                  <div
                    key={account.id}
                    className="grid gap-3 rounded-md border border-gray-200 px-3 py-3 dark:border-gray-800 sm:grid-cols-[minmax(0,1fr)_12rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {account.currency}
                        {!hasSnapshot && carryForward > 0 ? ` · carry-forward ${formatPLN(carryForward)}` : ''}
                      </p>
                    </div>
                    <CurrencyInput
                      value={balances[account.id] ?? 0}
                      onChange={value => setBalances(current => ({ ...current, [account.id]: value }))}
                      ariaLabel={account.name}
                      placeholder="0"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={activeAccounts.length === 0}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
          >
            Zapisz salda
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteSnapshotMonthDialogProps {
  yearMonth: string
  snapshotCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteSnapshotMonthDialog({
  yearMonth,
  snapshotCount,
  onConfirm,
  onCancel,
}: DeleteSnapshotMonthDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-snapshot-month-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-red-50 p-2 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 id="delete-snapshot-month-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Usunąć miesiąc {formatYearMonth(yearMonth)}?
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Usunie {snapshotCount} snapshotów kont z tego miesiąca. Tej operacji nie można cofnąć.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Usuń miesiąc
          </button>
        </div>
      </div>
    </div>
  )
}
