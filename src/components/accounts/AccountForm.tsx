import { useState } from 'react'
import { ACCOUNT_BUCKETS, BUCKET_LABELS } from '../../domain/accounts'
import type { Account, AccountBucket } from '../../domain/types'

type AccountFormData = Omit<Account, 'id' | 'openedAt' | 'closedAt'>

interface Props {
  initial?: Partial<Account>
  onSave: (data: AccountFormData) => void
  onCancel: () => void
}

export function AccountForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [bucket, setBucket] = useState<AccountBucket>(initial?.bucket ?? 'cash')
  const [currency, setCurrency] = useState(initial?.currency ?? 'PLN')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      bucket,
      currency: currency.trim() || 'PLN',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_220px_120px_auto_auto] md:items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nazwa konta</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Konto główne, IKE, XTB"
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bucket</label>
        <select
          value={bucket}
          onChange={e => setBucket(e.target.value as AccountBucket)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ACCOUNT_BUCKETS.map(item => (
            <option key={item} value={item}>{BUCKET_LABELS[item]}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Waluta</label>
        <input
          type="text"
          value={currency}
          onChange={e => setCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        Zapisz
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Anuluj
      </button>
    </form>
  )
}
