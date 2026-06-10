import { useMemo, useState } from 'react'
import { Percent } from 'lucide-react'
import { BELKA_TAX_RATE, projectMonthlyInvestment } from '../../domain/belka'
import { formatPLN } from '../../domain/formatting'

/*
 * Estymator podatku Belki: ta sama miesięczna wpłata na zwykłym koncie
 * maklerskim vs na IKE/IKZE (bez podatku od zysków przy wypłacie).
 */
export function BelkaEstimator() {
  const [monthly, setMonthly] = useState(1000)
  const [years, setYears] = useState(15)
  const [returnPct, setReturnPct] = useState(6)

  const taxable = useMemo(
    () => projectMonthlyInvestment(monthly, years, returnPct, BELKA_TAX_RATE),
    [monthly, years, returnPct],
  )
  const sheltered = useMemo(
    () => projectMonthlyInvestment(monthly, years, returnPct, 0),
    [monthly, years, returnPct],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Wpłata miesięczna (zł)" value={monthly} min={0} step={100} onChange={setMonthly} />
        <Field label="Horyzont (lata)" value={years} min={1} max={50} onChange={v => setYears(Math.max(1, v))} />
        <Field label="Oczekiwany zwrot (% rocznie)" value={returnPct} min={0} max={30} step={0.5} onChange={setReturnPct} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Zwykłe konto maklerskie
          </p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {formatPLN(taxable.netValue)}
          </p>
          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p>wpłacisz {formatPLN(taxable.contributed)}</p>
            <p>zysk {formatPLN(taxable.gains)}</p>
            <p className="text-rose-600 dark:text-rose-400">podatek Belki (19%) −{formatPLN(taxable.taxPaid)}</p>
          </div>
        </div>
        <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900 dark:bg-teal-950/20">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">
            IKE / IKZE (bez podatku Belki)
          </p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-teal-700 dark:text-teal-300">
            {formatPLN(sheltered.netValue)}
          </p>
          <div className="mt-2 space-y-1 text-xs text-teal-800/80 dark:text-teal-300/80">
            <p>wpłacisz {formatPLN(sheltered.contributed)}</p>
            <p>zysk {formatPLN(sheltered.gains)}</p>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              przewaga: +{formatPLN(Math.max(0, sheltered.netValue - taxable.netValue))}
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Percent size={13} className="mt-0.5 shrink-0" />
        Uproszczenie: podatek liczony raz przy wypłacie, bez podatku od dywidend po drodze.
        IKZE dodatkowo daje coroczny zwrot PIT (policzony w planerze IKZE), ale przy wypłacie
        pobierany jest 10% ryczałt.
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Math.max(min ?? 0, Number(event.target.value) || 0))}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  )
}
