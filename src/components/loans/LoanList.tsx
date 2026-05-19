import { useState } from 'react'
import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'
import { LoanForm } from './LoanForm'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { Loan } from '../../domain/types'

export function LoanList() {
  const loans = useStore(s => s.loans)
  const addLoan = useStore(s => s.addLoan)
  const updateLoan = useStore(s => s.updateLoan)
  const removeLoan = useStore(s => s.removeLoan)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {loans.map(loan => (
        editingId === loan.id ? (
          <LoanForm
            key={loan.id}
            initial={loan}
            onSave={data => { updateLoan(loan.id, data); setEditingId(null) }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <LoanRow
            key={loan.id}
            loan={loan}
            onEdit={() => setEditingId(loan.id)}
            onRemove={() => removeLoan(loan.id)}
          />
        )
      ))}

      {adding ? (
        <LoanForm
          onSave={data => { addLoan(data); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Plus size={14} /> Dodaj kredyt / ratę
        </button>
      )}
    </div>
  )
}

function LoanRow({ loan, onEdit, onRemove }: { loan: Loan; onEdit: () => void; onRemove: () => void }) {
  const monthsLeft = Math.ceil(loan.remainingBalance / loan.monthlyPayment)
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{loan.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPLN(loan.remainingBalance)} · {formatPLN(loan.monthlyPayment)}/mies. · ~{monthsLeft} mies. do spłaty
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
