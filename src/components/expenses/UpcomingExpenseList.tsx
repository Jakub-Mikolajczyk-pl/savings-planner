import { useState } from 'react'
import { CheckCircle2, Circle, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { UpcomingExpense } from '../../domain/types'
import { useStore } from '../../store'
import { UpcomingExpenseForm } from './UpcomingExpenseForm'

export function UpcomingExpenseList() {
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const addUpcomingExpense = useStore(s => s.addUpcomingExpense)
  const updateUpcomingExpense = useStore(s => s.updateUpcomingExpense)
  const removeUpcomingExpense = useStore(s => s.removeUpcomingExpense)
  const toggleUpcomingPaid = useStore(s => s.toggleUpcomingPaid)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = [...upcomingExpenses].sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1
    return a.targetMonth.localeCompare(b.targetMonth)
  })

  return (
    <div className="space-y-2">
      {sorted.map(expense => (
        editingId === expense.id ? (
          <UpcomingExpenseForm
            key={expense.id}
            initial={expense}
            onSave={data => { updateUpcomingExpense(expense.id, data); setEditingId(null) }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <UpcomingExpenseRow
            key={expense.id}
            expense={expense}
            onEdit={() => setEditingId(expense.id)}
            onRemove={() => removeUpcomingExpense(expense.id)}
            onToggle={() => toggleUpcomingPaid(expense.id)}
          />
        )
      ))}

      {adding ? (
        <UpcomingExpenseForm
          onSave={data => { addUpcomingExpense(data); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Plus size={14} /> Dodaj nadchodzący wydatek
        </button>
      )}
    </div>
  )
}

function UpcomingExpenseRow({
  expense,
  onEdit,
  onRemove,
  onToggle,
}: {
  expense: UpcomingExpense
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
}) {
  const paidClass = expense.isPaid ? 'opacity-55' : ''

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${paidClass}`}>
      <button
        onClick={onToggle}
        className={`p-1.5 rounded-md transition-colors ${
          expense.isPaid
            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={expense.isPaid ? 'Oznacz jako nieopłacone' : 'Oznacz jako opłacone'}
      >
        {expense.isPaid ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{expense.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPLN(expense.amount)} · {formatYearMonth(expense.targetMonth)}
          {expense.isPaid && ' · opłacone'}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Edytuj">
          <Pencil size={13} />
        </button>
        <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Usuń">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
