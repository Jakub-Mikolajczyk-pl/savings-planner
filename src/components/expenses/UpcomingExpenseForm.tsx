import { useState } from 'react'
import { currentYearMonth } from '../../domain/formatting'
import type { UpcomingExpense } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  initial?: UpcomingExpense
  onSave: (data: Omit<UpcomingExpense, 'id'>) => void
  onCancel: () => void
}

export function UpcomingExpenseForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? 0)
  const [targetMonth, setTargetMonth] = useState(initial?.targetMonth ?? currentYearMonth())
  const [isPaid, setIsPaid] = useState(initial?.isPaid ?? false)

  const valid = name.trim() && amount > 0 && targetMonth

  return (
    <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Nazwa wydatku
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. OC auta"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <CurrencyInput
          label="Kwota"
          value={amount}
          onChange={setAmount}
          className="sm:col-span-1"
        />
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Miesiąc
          </label>
          <input
            type="month"
            value={targetMonth}
            onChange={e => setTargetMonth(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={e => setIsPaid(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Opłacone
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
          onClick={() => valid && onSave({ name: name.trim(), amount, targetMonth, isPaid })}
          disabled={!valid}
          className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
        >
          {initial ? 'Zapisz' : 'Dodaj wydatek'}
        </button>
      </div>
    </div>
  )
}
