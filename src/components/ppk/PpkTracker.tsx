import { useMemo, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { useStore } from '../../store'
import { PPK_DEFAULTS, ppkMonthlyBreakdown, projectPpkBalance } from '../../domain/ppk'
import { formatPLN } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'

/*
 * Tracker PPK: składka pracownika schodzi z pensji, ale razem ze składką
 * pracodawcy i dopłatą państwa buduje osobne aktywo emerytalne.
 */
export function PpkTracker() {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const ppk = settings.ppk ?? PPK_DEFAULTS

  const [projYears, setProjYears] = useState(10)
  const [projReturnPct, setProjReturnPct] = useState(4)

  const breakdown = useMemo(() => ppkMonthlyBreakdown(ppk), [ppk])
  const projected = useMemo(
    () => projectPpkBalance(ppk, projYears, projReturnPct),
    [ppk, projYears, projReturnPct],
  )

  const update = (patch: Partial<typeof ppk>) => updateSettings({ ppk: { ...ppk, ...patch } })

  if (!ppk.enabled) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 p-4 text-center dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Pracujesz na etacie i odkładasz w PPK? Włącz tracker, żeby widzieć, ile
          naprawdę rośnie Twój rachunek (składka pracodawcy + dopłaty państwa to darmowe pieniądze).
        </p>
        <button
          type="button"
          onClick={() => update({ enabled: true })}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
        >
          <Briefcase size={15} />
          Włącz tracker PPK
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CurrencyInput
          label="Pensja brutto / mc"
          value={ppk.grossMonthlySalary}
          onChange={grossMonthlySalary => update({ grossMonthlySalary })}
        />
        <PercentField label="Składka pracownika (%)" value={ppk.employeePct} onChange={employeePct => update({ employeePct })} />
        <PercentField label="Składka pracodawcy (%)" value={ppk.employerPct} onChange={employerPct => update({ employerPct })} />
        <CurrencyInput label="Obecne saldo PPK" value={ppk.currentBalance} onChange={currentBalance => update({ currentBalance })} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCell label="Z Twojej pensji" value={`−${formatPLN(breakdown.employee)}`} tone="negative" />
        <SummaryCell label="Od pracodawcy" value={`+${formatPLN(breakdown.employer)}`} tone="positive" />
        <SummaryCell label="Od państwa (1/12)" value={`+${formatPLN(breakdown.state)}`} tone="positive" />
        <SummaryCell label="Rachunek rośnie o" value={`${formatPLN(breakdown.total)}/mc`} tone="positive" />
      </div>

      <label className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
        <input
          type="checkbox"
          checked={ppk.includeInCashflow}
          onChange={event => update({ includeInCashflow: event.target.checked })}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Odejmuj składkę pracownika od wolnych środków w planie
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            Włącz, jeśli kwota „Dochód / mc” w planie to pensja PRZED potrąceniem PPK.
            Jeśli wpisujesz wypłatę „na rękę” (już po PPK), zostaw wyłączone.
          </span>
        </span>
      </label>

      <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Projekcja salda PPK</p>
        <p className="mt-2 font-display text-xl font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
          {formatPLN(projected)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-indigo-900 dark:text-indigo-200">
          <label className="flex items-center gap-2">
            za
            <input
              type="number"
              min={1}
              max={50}
              value={projYears}
              onChange={e => setProjYears(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-md border border-indigo-200 bg-white px-2 py-1 text-right tabular-nums dark:border-indigo-900 dark:bg-gray-900"
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
              value={projReturnPct}
              onChange={e => setProjReturnPct(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 rounded-md border border-indigo-200 bg-white px-2 py-1 text-right tabular-nums dark:border-indigo-900 dark:bg-gray-900"
            />
            % rocznie
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => update({ enabled: false })}
        className="text-xs text-gray-400 underline-offset-2 hover:underline dark:text-gray-500"
      >
        Wyłącz tracker PPK
      </button>
    </div>
  )
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  )
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone === 'positive' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {value}
      </p>
    </div>
  )
}
