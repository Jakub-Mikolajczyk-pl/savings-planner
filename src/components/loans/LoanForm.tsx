import { useState } from 'react'
import type { Loan } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  initial?: Loan
  onSave: (data: Omit<Loan, 'id'>) => void
  onCancel: () => void
}

export function LoanForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [remaining, setRemaining] = useState(initial?.remainingBalance ?? 0)
  const [payment, setPayment] = useState(initial?.monthlyPayment ?? 0)

  const valid = name.trim() && remaining > 0 && payment > 0

  return (
    <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Nazwa kredytu
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Kredyt gotówkowy"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label="Pozostałe saldo"
          value={remaining}
          onChange={setRemaining}
        />
        <CurrencyInput
          label="Rata miesięczna"
          value={payment}
          onChange={setPayment}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Anuluj
        </button>
        <button
          onClick={() => valid && onSave({ name: name.trim(), remainingBalance: remaining, monthlyPayment: payment })}
          disabled={!valid}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {initial ? 'Zapisz' : 'Dodaj kredyt'}
        </button>
      </div>
    </div>
  )
}
