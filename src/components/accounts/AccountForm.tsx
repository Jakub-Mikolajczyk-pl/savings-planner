import { useState } from 'react'
import { ACCOUNT_BUCKETS, BUCKET_LABELS } from '../../domain/accounts'
import type { Account, AccountBucket } from '../../domain/types'

type AccountFormData = Omit<Account, 'id' | 'openedAt' | 'closedAt'>

interface Props {
  /*
   * Props to kontrakt komponentu.
   *
   * Angular porównanie:
   * initial/onSave/onCancel są jak @Input() + @Output(), tylko opisane typem TS
   * i przekazywane bez dekoratorów.
   */
  initial?: Partial<Account>
  onSave: (data: AccountFormData) => void
  onCancel: () => void
}

export function AccountForm({ initial, onSave, onCancel }: Props) {
  /*
   * Controlled form fields:
   * Stan inputów mieszka w React state, a input pokazuje value ze state.
   *
   * Angular porównanie:
   * - Template-driven: [(ngModel)] robi podobną dwukierunkową synchronizację.
   * - Reactive forms: FormControl trzyma value/validation osobno.
   * React najczęściej robi to jawnie: value + onChange.
   */
  const [name, setName] = useState(initial?.name ?? '')
  const [bucket, setBucket] = useState<AccountBucket>(initial?.bucket ?? 'accounts')
  const [currency, setCurrency] = useState(initial?.currency ?? 'PLN')

  const handleSubmit = (e: React.FormEvent) => {
    /*
     * HTML form submit przeładowałby stronę.
     * SPA zatrzymuje submit i wykonuje callback JS.
     */
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      /*
       * Komponent formularza nie generuje id i nie zna backendu.
       * To ważna separacja odpowiedzialności: formularz zbiera dane,
       * store nadaje id/sync/rollback.
       */
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
        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-md transition-colors dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
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
