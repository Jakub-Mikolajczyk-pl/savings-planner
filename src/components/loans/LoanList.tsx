import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'
import { LoanForm } from './LoanForm'
import { CircleCheck, Pencil, Trash2, Plus } from 'lucide-react'
import type { Loan } from '../../domain/types'

export function LoanList() {
  const loans = useStore(s => s.loans)
  const addLoan = useStore(s => s.addLoan)
  const updateLoan = useStore(s => s.updateLoan)
  const markLoanPaymentPaid = useStore(s => s.markLoanPaymentPaid)
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
            onPaymentPaid={() => markLoanPaymentPaid(loan.id)}
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

function LoanRow({
  loan,
  onPaymentPaid,
  onEdit,
  onRemove,
}: {
  loan: Loan
  onPaymentPaid: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const [paymentFeedback, setPaymentFeedback] = useState<'idle' | 'updating' | 'saved'>('idle')
  const isPaidOff = loan.remainingBalance <= 0
  const monthsLeft = loan.monthlyPayment > 0 ? Math.ceil(loan.remainingBalance / loan.monthlyPayment) : 0
  const paymentAmount = Math.min(loan.remainingBalance, loan.monthlyPayment)
  const paymentLabel = isPaidOff
    ? 'Kredyt spłacony'
    : `Oznacz ratę ${formatPLN(paymentAmount)} jako zapłaconą`
  const isPaymentLocked = isPaidOff || paymentFeedback !== 'idle'
  const paidButtonText = paymentFeedback === 'updating'
    ? 'Aktualizuję...'
    : paymentFeedback === 'saved'
      ? 'Zapisano'
      : 'Zapłacona'
  const paidButtonLabel = paymentFeedback === 'updating'
    ? 'Aktualizuję ratę'
    : paymentFeedback === 'saved'
      ? 'Rata zapisana'
      : paymentLabel
  const paidButtonClass = `inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed sm:min-w-[6.75rem] ${
    paymentFeedback === 'saved'
      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800'
      : paymentFeedback === 'updating'
        ? 'bg-gray-50 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
        : 'text-emerald-700 hover:bg-emerald-50 disabled:text-gray-300 disabled:hover:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-900/30 dark:disabled:text-gray-600'
  }`

  useEffect(() => {
    if (paymentFeedback !== 'updating') return

    const timeoutId = window.setTimeout(() => setPaymentFeedback('saved'), 180)
    return () => window.clearTimeout(timeoutId)
  }, [paymentFeedback])

  useEffect(() => {
    if (paymentFeedback !== 'saved') return

    const timeoutId = window.setTimeout(() => setPaymentFeedback('idle'), 900)
    return () => window.clearTimeout(timeoutId)
  }, [paymentFeedback])

  const handlePaymentPaid = () => {
    if (isPaymentLocked) return

    onPaymentPaid()
    setPaymentFeedback('updating')
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{loan.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPLN(loan.remainingBalance)} · {formatPLN(loan.monthlyPayment)}/mies. · ~{monthsLeft} mies. do spłaty
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={handlePaymentPaid}
          disabled={isPaymentLocked}
          title={paidButtonLabel}
          aria-label={paidButtonLabel}
          aria-live="polite"
          className={paidButtonClass}
        >
          <CircleCheck size={13} className={paymentFeedback === 'idle' ? undefined : 'animate-pulse'} />
          <span className="hidden sm:inline">{paidButtonText}</span>
        </button>
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
