import { useState } from 'react'
import type { Goal } from '../../domain/types'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  initial?: Partial<Goal>
  onSave: (data: Omit<Goal, 'id' | 'priority'>) => void
  onCancel: () => void
}

export function GoalForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial?.targetAmount ?? 0)
  const [currentSaved, setCurrentSaved] = useState(initial?.currentSaved ?? 0)
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [fixedAllocation, setFixedAllocation] = useState(initial?.fixedAllocation ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || target <= 0) return
    onSave({
      name: name.trim(),
      targetAmount: target,
      currentSaved: currentSaved > 0 ? currentSaved : undefined,
      deadline: deadline || undefined,
      fixedAllocation: fixedAllocation > 0 ? fixedAllocation : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nazwa celu</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Wakacje 2027, Wkład własny..."
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput label="Cel (kwota)" value={target} onChange={setTarget} />
        <CurrencyInput label="Już odłożone" value={currentSaved} onChange={setCurrentSaved} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Deadline (opcjonalny)
        </label>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">Ustaw jeśli masz konkretną datę — wpływa na priorytet alokacji</p>
      </div>

      <div>
        <CurrencyInput
          label="Stała alokacja miesięczna (opcjonalna)"
          value={fixedAllocation}
          onChange={setFixedAllocation}
        />
        <p className="text-xs text-gray-400 mt-1">Jeśli ustawisz, ta kwota zawsze trafi na ten cel. Reszta wolnych środków pójdzie do innych celów.</p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-md transition-colors dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
        >
          Zapisz
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Anuluj
        </button>
      </div>
    </form>
  )
}
