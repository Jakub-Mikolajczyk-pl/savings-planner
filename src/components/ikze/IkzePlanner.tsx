import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, PiggyBank } from 'lucide-react'
import { useStore } from '../../store'
import type { IkzeParticipantRole, IkzePlanEntry, IkzePlanStatus } from '../../domain/types'
import { buildDefaultIkzePlans, calculateIkzeEntry, summarizeIkzePlans } from '../../domain/ikze'
import { formatPLN } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'

const roleLabels: Record<IkzeParticipantRole, string> = {
  employee: 'Pracownik',
  entrepreneur: 'Przedsiębiorca',
}

const statusLabels: Record<IkzePlanStatus, string> = {
  missing_limit: 'Brak limitu',
  in_progress: 'W toku',
  complete: 'Gotowe',
  over_limit: 'Limit przekroczony',
}

const statusClass: Record<IkzePlanStatus, string> = {
  missing_limit: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300',
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  over_limit: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
}

function statusIcon(status: IkzePlanStatus) {
  if (status === 'complete') return <CheckCircle2 size={14} />
  if (status === 'over_limit') return <AlertTriangle size={14} />
  return <CircleDashed size={14} />
}

function NumberField({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string
  value: number
  min?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  )
}

export function IkzePlanner() {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const plans = settings.ikzePlans && settings.ikzePlans.length > 0
    ? settings.ikzePlans
    : buildDefaultIkzePlans(settings.startMonth)

  const calculated = useMemo(() => plans.map(calculateIkzeEntry), [plans])
  const summary = useMemo(() => summarizeIkzePlans(plans), [plans])

  const updatePlan = (id: string, patch: Partial<IkzePlanEntry>) => {
    updateSettings({
      ikzePlans: plans.map(plan => plan.id === id ? { ...plan, ...patch } : plan),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCell label="Limit razem" value={formatPLN(summary.annualLimit)} />
        <SummaryCell label="Wpłacono" value={formatPLN(summary.contributedAmount)} />
        <SummaryCell label="Zostało" value={formatPLN(summary.remaining)} />
        <SummaryCell label="Na wypłatę" value={formatPLN(summary.perPayout)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {calculated.map(plan => (
          <div key={plan.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <PiggyBank size={16} className="text-indigo-600 dark:text-indigo-300" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.ownerName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabels[plan.role]} · IKZE {plan.year}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${statusClass[plan.status]}`}>
                {statusIcon(plan.status)}
                {statusLabels[plan.status]}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Rok" value={plan.year} min={2000} onChange={year => updatePlan(plan.id, { year })} />
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Typ limitu</span>
                <select
                  value={plan.role}
                  onChange={event => updatePlan(plan.id, { role: event.target.value as IkzeParticipantRole })}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="employee">Pracownik</option>
                  <option value="entrepreneur">Przedsiębiorca</option>
                </select>
              </label>
              <CurrencyInput label="Limit roczny" value={plan.annualLimit} onChange={annualLimit => updatePlan(plan.id, { annualLimit })} />
              <CurrencyInput label="Już wpłacono" value={plan.contributedAmount} onChange={contributedAmount => updatePlan(plan.id, { contributedAmount })} />
              <NumberField label="Wypłat zostało" value={plan.payoutsLeft} onChange={payoutsLeft => updatePlan(plan.id, { payoutsLeft })} />
              <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Rekomendacja</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatPLN(plan.perPayout)}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">zostało {formatPLN(plan.remaining)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
