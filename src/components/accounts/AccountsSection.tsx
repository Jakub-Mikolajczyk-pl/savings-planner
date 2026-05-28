import { useMemo, useState } from 'react'
import { CalendarPlus, Eye, EyeOff, Lock, Pencil, Plus, Trash2, Unlock } from 'lucide-react'
import { allSnapshotMonths, BUCKET_LABELS } from '../../domain/accounts'
import { addMonths, currentYearMonth } from '../../domain/formatting'
import { useStore } from '../../store'
import type { Account } from '../../domain/types'
import { AccountForm } from './AccountForm'
import { AccountsTable } from './AccountsTable'

export function AccountsSection() {
  const accounts = useStore(s => s.accounts)
  const snapshots = useStore(s => s.accountSnapshots)
  const addAccount = useStore(s => s.addAccount)
  const updateAccount = useStore(s => s.updateAccount)
  const removeAccount = useStore(s => s.removeAccount)
  const closeAccount = useStore(s => s.closeAccount)
  const reopenAccount = useStore(s => s.reopenAccount)
  const setSnapshot = useStore(s => s.setSnapshot)
  const removeSnapshot = useStore(s => s.removeSnapshot)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [draftMonths, setDraftMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())

  const months = useMemo(() => {
    const combined = [...allSnapshotMonths(snapshots), ...draftMonths]
    return [...new Set(combined)].sort().reverse()
  }, [draftMonths, snapshots])

  const visibleAccounts = useMemo(
    () => accounts.filter(account => showClosed || !account.closedAt),
    [accounts, showClosed],
  )

  const addDraftMonth = (yearMonth: string) => {
    setDraftMonths(current => current.includes(yearMonth) ? current : [...current, yearMonth])
    setSelectedMonth(yearMonth)
  }

  const addNextMonth = () => {
    const latest = months[0] ?? currentYearMonth()
    addDraftMonth(addMonths(latest, 1))
  }

  const handleSetSnapshot = (accountId: string, yearMonth: string, balance: number) => {
    setSnapshot(accountId, yearMonth, balance)
    setDraftMonths(current => current.filter(month => month !== yearMonth))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {adding ? (
          <div className="w-full p-4 border border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">Nowe konto</p>
            <AccountForm
              onSave={data => { addAccount(data); setAdding(false) }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Dodaj konto
          </button>
        )}

        <button
          onClick={() => setShowClosed(value => !value)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {showClosed ? <EyeOff size={15} /> : <Eye size={15} />}
          {showClosed ? 'Ukryj zamknięte' : 'Pokaż zamknięte'}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => addDraftMonth(selectedMonth)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <CalendarPlus size={15} />
            Dodaj miesiąc
          </button>
          <button
            onClick={addNextMonth}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Kolejny
          </button>
        </div>
      </div>

      {visibleAccounts.length > 0 && (
        <div className="space-y-2">
          {visibleAccounts.map(account => (
            editingId === account.id ? (
              <div key={account.id} className="p-4 border border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">Edytuj konto</p>
                <AccountForm
                  initial={account}
                  onSave={data => { updateAccount(account.id, data); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <AccountRow
                key={account.id}
                account={account}
                latestMonth={months[0] ?? currentYearMonth()}
                onEdit={() => setEditingId(account.id)}
                onRemove={() => removeAccount(account.id)}
                onClose={yearMonth => closeAccount(account.id, yearMonth)}
                onReopen={() => reopenAccount(account.id)}
              />
            )
          ))}
        </div>
      )}

      <AccountsTable
        accounts={visibleAccounts}
        snapshots={snapshots}
        months={months}
        onSetSnapshot={handleSetSnapshot}
        onRemoveSnapshot={removeSnapshot}
      />
    </div>
  )
}

function AccountRow({
  account,
  latestMonth,
  onEdit,
  onRemove,
  onClose,
  onReopen,
}: {
  account: Account
  latestMonth: string
  onEdit: () => void
  onRemove: () => void
  onClose: (yearMonth: string) => void
  onReopen: () => void
}) {
  const [closeMonth, setCloseMonth] = useState(account.closedAt ?? latestMonth)

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex-1 min-w-56">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
          {account.closedAt && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">zamknięte</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {BUCKET_LABELS[account.bucket]} · {account.currency}
          {account.openedAt ? ` · od ${account.openedAt}` : ''}
          {account.closedAt ? ` · do ${account.closedAt}` : ''}
        </p>
      </div>

      {!account.closedAt && (
        <input
          type="month"
          value={closeMonth}
          onChange={e => setCloseMonth(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Miesiąc zamknięcia"
        />
      )}

      <div className="flex items-center gap-1">
        {account.closedAt ? (
          <button
            onClick={onReopen}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            aria-label="Otwórz konto"
            title="Otwórz konto"
          >
            <Unlock size={14} />
          </button>
        ) : (
          <button
            onClick={() => onClose(closeMonth)}
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
            aria-label="Zamknij konto"
            title="Zamknij konto"
          >
            <Lock size={14} />
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          aria-label="Edytuj konto"
          title="Edytuj konto"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          aria-label="Usuń konto"
          title="Usuń konto"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
