import { useState } from 'react'
import type { Subscription } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  initial?: Subscription
  onSave: (data: Omit<Subscription, 'id'>) => void
  onCancel: () => void
}

export function SubscriptionForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [monthlyAmount, setMonthlyAmount] = useState(initial?.monthlyAmount ?? 0)
  const [category, setCategory] = useState(initial?.category ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [nextCharge, setNextCharge] = useState(initial?.nextCharge ?? '')

  const valid = name.trim() && monthlyAmount > 0

  return (
    <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Nazwa abonamentu
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Spotify"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label="Kwota / mies."
          value={monthlyAmount}
          onChange={setMonthlyAmount}
        />
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Kategoria
          </label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="opcjonalnie"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Następna płatność
          </label>
          <input
            type="date"
            value={nextCharge}
            onChange={e => setNextCharge(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Aktywny
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Anuluj
        </button>
        <button
          onClick={() => valid && onSave({
            name: name.trim(),
            monthlyAmount,
            active,
            category: category.trim() || undefined,
            nextCharge: nextCharge || undefined,
          })}
          disabled={!valid}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {initial ? 'Zapisz' : 'Dodaj abonament'}
        </button>
      </div>
    </div>
  )
}
