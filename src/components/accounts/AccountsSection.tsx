import { useMemo, useState } from 'react'
import { CalendarPlus, Eye, EyeOff, FileUp, Lock, Pencil, Plus, Trash2, Unlock } from 'lucide-react'
import { ACCOUNT_BUCKETS, allSnapshotMonths, balanceAsOf, BUCKET_LABELS } from '../../domain/accounts'
import { addMonths, currentYearMonth, formatPLN } from '../../domain/formatting'
import { useStore } from '../../store'
import type { Account, AccountBucket, AccountSnapshot } from '../../domain/types'
import { AccountForm } from './AccountForm'
import { AccountsTable } from './AccountsTable'
import { AssetsKpi } from './AssetsKpi'
import { AssetsPie } from './AssetsPie'
import { ImportCsvDialog } from './ImportCsvDialog'
import { NetWorthChart } from './NetWorthChart'

export function AccountsSection() {
  const accounts = useStore(s => s.accounts)
  const snapshots = useStore(s => s.accountSnapshots)
  const emergencyFundBuckets = useStore(s => s.settings.emergencyFundBuckets ?? ['safety_cushion'])
  const loans = useStore(s => s.loans)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const addAccount = useStore(s => s.addAccount)
  const updateAccount = useStore(s => s.updateAccount)
  const updateSettings = useStore(s => s.updateSettings)
  const removeAccount = useStore(s => s.removeAccount)
  const closeAccount = useStore(s => s.closeAccount)
  const reopenAccount = useStore(s => s.reopenAccount)
  const setSnapshot = useStore(s => s.setSnapshot)
  const removeSnapshot = useStore(s => s.removeSnapshot)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [importCsvOpen, setImportCsvOpen] = useState(false)
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
      <AssetsKpi accounts={accounts} snapshots={snapshots} emergencyFundBuckets={emergencyFundBuckets} />

      <EmergencyFundBucketsPanel
        accounts={accounts}
        snapshots={snapshots}
        selectedBuckets={emergencyFundBuckets}
        onChange={buckets => updateSettings({ emergencyFundBuckets: buckets })}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historia net worth</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Pełna oś snapshotów kont z bieżącym długiem jako korektą netto.</p>
          </div>
          <NetWorthChart accounts={accounts} snapshots={snapshots} loans={loans} mortgagePlan={mortgagePlan} />
        </div>
        <AssetsPie accounts={accounts} snapshots={snapshots} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {adding ? (
          <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Nowe konto</p>
            <AccountForm
              onSave={data => { addAccount(data); setAdding(false) }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
          >
            <Plus size={15} />
            Dodaj konto
          </button>
        )}

        <button
          onClick={() => setShowClosed(value => !value)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {showClosed ? <EyeOff size={15} /> : <Eye size={15} />}
          {showClosed ? 'Ukryj zamknięte' : 'Pokaż zamknięte'}
        </button>

        <button
          onClick={() => setImportCsvOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <FileUp size={15} />
          Import CSV
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => addDraftMonth(selectedMonth)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <CalendarPlus size={15} />
            Dodaj miesiąc
          </button>
          <button
            onClick={addNextMonth}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Kolejny
          </button>
        </div>
      </div>

      {visibleAccounts.length > 0 && (
        <div className="space-y-2">
          {visibleAccounts.map(account => (
            editingId === account.id ? (
              <div key={account.id} className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Edytuj konto</p>
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
                onRemove={() => {
                  if (window.confirm(`Usunąć konto „${account.name}"? Skasuje też wszystkie jego snapshoty. Tej operacji nie można cofnąć.`)) {
                    removeAccount(account.id)
                  }
                }}
                onClose={yearMonth => closeAccount(account.id, yearMonth)}
                onReopen={() => reopenAccount(account.id)}
              />
            )
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Snapshoty kont</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Tabela jest tylko w domenie Majątek; cashflow mieszka w zakładce Plan.</p>
        </div>
        <AccountsTable
          accounts={visibleAccounts}
          snapshots={snapshots}
          months={months}
          onSetSnapshot={handleSetSnapshot}
          onRemoveSnapshot={removeSnapshot}
        />
      </div>

      {importCsvOpen && <ImportCsvDialog onClose={() => setImportCsvOpen(false)} />}
    </div>
  )
}

function EmergencyFundBucketsPanel({
  accounts,
  snapshots,
  selectedBuckets,
  onChange,
}: {
  accounts: Account[]
  snapshots: AccountSnapshot[]
  selectedBuckets: AccountBucket[]
  onChange: (buckets: AccountBucket[]) => void
}) {
  const latestMonth = allSnapshotMonths(snapshots).at(-1)
  const toggleBucket = (bucket: AccountBucket) => {
    if (selectedBuckets.includes(bucket)) {
      if (selectedBuckets.length === 1) return
      onChange(selectedBuckets.filter(item => item !== bucket))
      return
    }
    onChange([...selectedBuckets, bucket])
  }

  const total = latestMonth
    ? accounts
        .filter(account => selectedBuckets.includes(account.bucket))
        .reduce((sum, account) => sum + balanceAsOf(snapshots, account, latestMonth), 0)
    : 0

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Poduszka bezpieczeństwa</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Wybierz buckety, które sumują się do poduszki (docelowo ~6 miesięcy kosztów rodziny). Fundusz awaryjny liczy się osobno z bucketu „Fundusz awaryjny".
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">{latestMonth ?? 'Brak snapshotów'}</p>
          <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatPLN(total)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {ACCOUNT_BUCKETS.map(bucket => {
          const selected = selectedBuckets.includes(bucket)
          const bucketTotal = latestMonth
            ? accounts
                .filter(account => account.bucket === bucket)
                .reduce((sum, account) => sum + balanceAsOf(snapshots, account, latestMonth), 0)
            : 0

          return (
            <label
              key={bucket}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                selected
                  ? 'border-gray-400 bg-gray-100 text-gray-950 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleBucket(bucket)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              <span className="min-w-0">
                <span className="block font-medium">{BUCKET_LABELS[bucket]}</span>
                <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatPLN(bucketTotal)}</span>
              </span>
            </label>
          )
        })}
      </div>
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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-56 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
          {account.closedAt && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">zamknięte</span>
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
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          aria-label="Miesiąc zamknięcia"
        />
      )}

      <div className="flex items-center gap-1">
        {account.closedAt ? (
          <button
            onClick={onReopen}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/30"
            aria-label="Otwórz konto"
            title="Otwórz konto"
          >
            <Unlock size={14} />
          </button>
        ) : (
          <button
            onClick={() => onClose(closeMonth)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
            aria-label="Zamknij konto"
            title="Zamknij konto"
          >
            <Lock size={14} />
          </button>
        )}
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Edytuj konto"
          title="Edytuj konto"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onRemove}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          aria-label="Usuń konto"
          title="Usuń konto"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
