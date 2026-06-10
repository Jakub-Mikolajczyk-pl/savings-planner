import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store'
import type { IkePlanEntry, IkzePlanStatus } from '../../domain/types'
import {
  buildDefaultIkePlans,
  calculateIkeEntry,
  IKE_LIMITS,
  projectIkeTaxFreeBenefit,
  summarizeIkePlans,
} from '../../domain/ike'
import { formatPLN } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'

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

export function IkePlanner() {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const plans = settings.ikePlans && settings.ikePlans.length > 0
    ? settings.ikePlans
    : buildDefaultIkePlans(settings.startMonth)

  // Założenia korzyści podatkowej — tylko do estymacji, nie są zapisywane.
  const [benefitYears, setBenefitYears] = useState(15)
  const [benefitReturnPct, setBenefitReturnPct] = useState(5)

  const calculated = useMemo(() => plans.map(calculateIkeEntry), [plans])
  const summary = useMemo(() => summarizeIkePlans(plans), [plans])
  const belkaSaved = useMemo(
    () => projectIkeTaxFreeBenefit(summary.perPayout, benefitYears, benefitReturnPct),
    [summary.perPayout, benefitYears, benefitReturnPct],
  )

  const updatePlan = (id: string, patch: Partial<IkePlanEntry>) => {
    updateSettings({
      ikePlans: plans.map(plan => {
        if (plan.id !== id) return plan
        const next = { ...plan, ...patch }
        // Zmiana roku podmienia limit, o ile user nie wpisał własnego.
        if (patch.year !== undefined) {
          const oldStandardLimit = IKE_LIMITS[plan.year] ?? 0
          if (plan.annualLimit === 0 || plan.annualLimit === oldStandardLimit) {
            next.annualLimit = IKE_LIMITS[next.year] ?? IKE_LIMITS[2026] ?? 0
          }
        }
        return next
      }),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCell label="Limit razem" value={formatPLN(summary.annualLimit)} />
        <SummaryCell label="Wpłacono" value={formatPLN(summary.contributedAmount)} />
        <SummaryCell label="Zostało" value={formatPLN(summary.remaining)} />
        <SummaryCell label="Na wypłatę" value={formatPLN(summary.perPayout)} />
      </div>

      <label className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
        <input
          type="checkbox"
          checked={settings.includeIkeContributionsInCashflow ?? false}
          onChange={event => updateSettings({ includeIkeContributionsInCashflow: event.target.checked })}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Odejmuj rekomendowane wpłaty IKE od wolnych środków
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            Po włączeniu kwota „Na wypłatę” jest traktowana jak miesięczny koszt planu — tak samo jak w IKZE.
          </span>
        </span>
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        {calculated.map(plan => (
          <div key={plan.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-teal-600 dark:text-teal-300" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.ownerName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">IKE {plan.year}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${statusClass[plan.status]}`}>
                {statusIcon(plan.status)}
                {statusLabels[plan.status]}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Rok" value={plan.year} min={2000} onChange={year => updatePlan(plan.id, { year })} />
              <CurrencyInput label="Limit roczny" value={plan.annualLimit} onChange={annualLimit => updatePlan(plan.id, { annualLimit })} />
              <CurrencyInput label="Już wpłacono" value={plan.contributedAmount} onChange={contributedAmount => updatePlan(plan.id, { contributedAmount })} />
              <NumberField label="Wypłat zostało" value={plan.payoutsLeft} onChange={payoutsLeft => updatePlan(plan.id, { payoutsLeft })} />
              <div className="rounded-md border border-gray-100 px-3 py-2 dark:border-gray-800 sm:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Rekomendacja, żeby domknąć limit do końca roku</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatPLN(plan.perPayout)} / wypłatę</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">zostało {formatPLN(plan.remaining)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900 dark:bg-teal-950/20">
        <p className="text-sm font-medium text-teal-900 dark:text-teal-200">
          Dlaczego warto: zysk bez podatku Belki
        </p>
        <p className="mt-1 text-xs text-teal-800/80 dark:text-teal-300/80">
          Wypłata z IKE po 60. roku życia jest wolna od 19% podatku od zysków. Przy obecnej
          rekomendowanej wpłacie ({formatPLN(summary.perPayout)}/mc) unikasz około:
        </p>
        <p className="mt-2 font-display text-xl font-semibold tabular-nums text-teal-700 dark:text-teal-300">
          {formatPLN(belkaSaved)} podatku
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-teal-900 dark:text-teal-200">
          <label className="flex items-center gap-2">
            horyzont
            <input
              type="number"
              min={1}
              max={50}
              value={benefitYears}
              onChange={e => setBenefitYears(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-md border border-teal-200 bg-white px-2 py-1 text-right tabular-nums dark:border-teal-900 dark:bg-gray-900"
            />
            lat
          </label>
          <label className="flex items-center gap-2">
            zwrot
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={benefitReturnPct}
              onChange={e => setBenefitReturnPct(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 rounded-md border border-teal-200 bg-white px-2 py-1 text-right tabular-nums dark:border-teal-900 dark:bg-gray-900"
            />
            % rocznie
          </label>
        </div>
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
