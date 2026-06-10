import { useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import { allSnapshotMonths, sumBucketBalances } from '../../domain/accounts'
import { fireBands, type FireInputs } from '../../domain/fire'
import { addMonths, currentYearMonth, formatPLN, formatYearMonth } from '../../domain/formatting'
import { ppkMonthlyBreakdown } from '../../domain/ppk'
import { ikzeMonthlyContributionCost } from '../../domain/ikze'
import { ikeMonthlyContributionCost } from '../../domain/ike'
import { useStore } from '../../store'

/*
 * "Kiedy mogę przestać pracować" — jedna liczba, dla której ta aplikacja
 * tak naprawdę istnieje. Kapitał startowy podpowiadamy z bucketów
 * emerytalno-inwestycyjnych, wpłatę z realnych składek + wolnych środków.
 */
export function FireProjection() {
  const settings = useStore(s => s.settings)
  const accounts = useStore(s => s.accounts)
  const snapshots = useStore(s => s.accountSnapshots)
  const getSchedule = useStore(s => s.getSchedule)

  const suggestedCapital = useMemo(() => {
    const latest = allSnapshotMonths(snapshots).at(-1)
    if (!latest) return 0
    return Math.round(sumBucketBalances(accounts, snapshots, latest, ['retirement', 'investments'], settings))
  }, [accounts, snapshots, settings])

  const suggestedContribution = useMemo(() => {
    const freeCash = Math.max(0, getSchedule().rows[0]?.freeCash ?? 0)
    const retirement = ikzeMonthlyContributionCost(settings)
      + ikeMonthlyContributionCost(settings)
      + ppkMonthlyBreakdown(settings.ppk).total
    return Math.round(freeCash + retirement)
  }, [getSchedule, settings])

  const [capital, setCapital] = useState<number | null>(null)
  const [contribution, setContribution] = useState<number | null>(null)
  const [returnPct, setReturnPct] = useState(4)
  const [spending, setSpending] = useState<number | null>(null)
  const [swr, setSwr] = useState(4)

  const inputs: FireInputs = {
    currentCapital: capital ?? suggestedCapital,
    monthlyContribution: contribution ?? suggestedContribution,
    annualReturnPct: returnPct,
    targetMonthlySpending: spending ?? settings.monthlyExpenses,
    withdrawalRatePct: swr,
  }

  const bands = useMemo(() => fireBands(inputs), [inputs.currentCapital, inputs.monthlyContribution, inputs.annualReturnPct, inputs.targetMonthlySpending, inputs.withdrawalRatePct]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = currentYearMonth()
  const fireLabel = (months?: number) =>
    months === undefined ? 'poza zasięgiem (100 lat)' : months === 0 ? 'już teraz 🎉' : `${formatYearMonth(addMonths(start, months))} (za ${Math.round(months / 12 * 10) / 10} lat)`

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Kapitał startowy (zł)" value={inputs.currentCapital} step={1000} onChange={setCapital} hint={`buckety: ${formatPLN(suggestedCapital)}`} />
        <Field label="Wpłata / mc (zł)" value={inputs.monthlyContribution} step={100} onChange={setContribution} hint={`z planu: ${formatPLN(suggestedContribution)}`} />
        <Field label="Realny zwrot (%)" value={returnPct} step={0.5} onChange={v => setReturnPct(Math.max(0, v))} hint="po inflacji, np. 4" />
        <Field label="Wydatki na FIRE / mc (zł)" value={inputs.targetMonthlySpending} step={100} onChange={setSpending} hint={`dziś: ${formatPLN(settings.monthlyExpenses)}`} />
        <Field label="Stopa wypłaty SWR (%)" value={swr} step={0.25} onChange={v => setSwr(Math.max(0.5, v))} hint="4% = reguła 25×" />
      </div>

      <div className="rounded-md border border-orange-200 bg-orange-50/40 p-4 dark:border-orange-900/60 dark:bg-orange-950/15">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-600 dark:text-orange-400" />
          <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
            Cel FIRE: <span className="font-semibold tabular-nums">{formatPLN(bands.base.targetAmount)}</span>
            <span className="ml-1 text-xs text-orange-700/70 dark:text-orange-300/70">
              ({formatPLN(inputs.targetMonthlySpending)}/mc przy SWR {swr}%)
            </span>
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <BandCell label={`Pesymistycznie (${Math.max(0, returnPct - 2)}%)`} value={fireLabel(bands.pessimistic.monthsToTarget)} />
          <BandCell label={`Bazowo (${returnPct}%)`} value={fireLabel(bands.base.monthsToTarget)} emphasized />
          <BandCell label={`Optymistycznie (${returnPct + 2}%)`} value={fireLabel(bands.optimistic.monthsToTarget)} />
        </div>
        <p className="mt-3 text-xs text-orange-800/70 dark:text-orange-300/70">
          Uproszczenie: stały realny zwrot, stała wpłata, bez podatku Belki (zakładamy konta
          IKE/IKZE i długi horyzont). To kompas, nie wyrocznia.
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  step,
  hint,
  onChange,
}: {
  label: string
  value: number
  step: number
  hint?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      {hint && <span className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
    </label>
  )
}

function BandCell({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${emphasized ? 'border-orange-300 bg-white dark:border-orange-800 dark:bg-gray-900' : 'border-orange-200/60 dark:border-orange-900/40'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${emphasized ? 'text-orange-700 dark:text-orange-300' : 'text-gray-800 dark:text-gray-200'}`}>{value}</p>
    </div>
  )
}
