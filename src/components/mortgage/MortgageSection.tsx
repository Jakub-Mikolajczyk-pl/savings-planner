import { useMemo, useState } from 'react'
import { Home, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import type { MortgageOneTimeOverpayment, MortgageOverpaymentMode, MortgagePlan } from '../../domain/types'
import { buildMortgageSchedule } from '../../domain/mortgage'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'

const defaultPlan = (): Omit<MortgagePlan, 'id'> => ({
  name: 'Kredyt hipoteczny',
  principal: 500000,
  annualInterestRate: 6,
  originalTermMonths: 360,
  termMonths: 348,
  monthlyOverpayment: 0,
  overpaymentMode: 'shortenTerm',
  oneTimeOverpayments: [],
  refinanceAnnualInterestRate: 0,
  refinanceCost: 0,
})

function normalizePlan(plan: MortgagePlan | undefined): Omit<MortgagePlan, 'id'> & { id?: string } {
  return plan
    ? {
        ...plan,
        originalTermMonths: plan.originalTermMonths ?? plan.termMonths,
        refinanceAnnualInterestRate: plan.refinanceAnnualInterestRate ?? 0,
        refinanceCost: plan.refinanceCost ?? 0,
      }
    : defaultPlan()
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full pr-10 pl-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right tabular-nums"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

export function MortgageSection() {
  const settings = useStore(s => s.settings)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const saveMortgagePlan = useStore(s => s.saveMortgagePlan)
  const removeMortgagePlan = useStore(s => s.removeMortgagePlan)
  const [draft, setDraft] = useState<Omit<MortgagePlan, 'id'> & { id?: string }>(
    normalizePlan(mortgagePlan),
  )

  const { entries, summary } = useMemo(
    () => buildMortgageSchedule(mortgagePlan, settings.startMonth, settings.horizonMonths, true),
    [mortgagePlan, settings.startMonth, settings.horizonMonths],
  )

  const updateDraft = (patch: Partial<typeof draft>) => setDraft(current => ({ ...current, ...patch }))
  const save = () => {
    if (draft.principal <= 0 || draft.termMonths <= 0 || draft.originalTermMonths <= 0 || draft.annualInterestRate < 0) return
    saveMortgagePlan({
      ...draft,
      originalTermMonths: Math.max(draft.originalTermMonths, draft.termMonths),
    })
  }

  const addOneTimeOverpayment = () => {
    updateDraft({
      oneTimeOverpayments: [
        ...draft.oneTimeOverpayments,
        { id: crypto.randomUUID(), yearMonth: settings.startMonth, amount: 0 },
      ],
    })
  }

  const updateOneTimeOverpayment = (id: string, patch: Partial<MortgageOneTimeOverpayment>) => {
    updateDraft({
      oneTimeOverpayments: draft.oneTimeOverpayments.map(item =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  const removeOneTimeOverpayment = (id: string) => {
    updateDraft({
      oneTimeOverpayments: draft.oneTimeOverpayments.filter(item => item.id !== id),
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Nazwa
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={e => updateDraft({ name: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <CurrencyInput label="Saldo kapitału" value={draft.principal} onChange={v => updateDraft({ principal: v })} />
            <NumberInput label="Oprocentowanie" value={draft.annualInterestRate} min={0} max={30} step={0.01} suffix="%" onChange={v => updateDraft({ annualInterestRate: v })} />
            <NumberInput label="Cały okres" value={draft.originalTermMonths} min={1} max={480} suffix="m" onChange={v => updateDraft({ originalTermMonths: v })} />
            <NumberInput label="Pozostały okres" value={draft.termMonths} min={1} max={480} suffix="m" onChange={v => updateDraft({ termMonths: v })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <NumberInput
              label="Refinansowanie na"
              value={draft.refinanceAnnualInterestRate ?? 0}
              min={0}
              max={30}
              step={0.01}
              suffix="%"
              onChange={v => updateDraft({ refinanceAnnualInterestRate: v })}
            />
            <CurrencyInput
              label="Koszt refinansowania"
              value={draft.refinanceCost ?? 0}
              onChange={v => updateDraft({ refinanceCost: v })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
            <CurrencyInput
              label="Stała nadpłata miesięczna"
              value={draft.monthlyOverpayment}
              onChange={v => updateDraft({ monthlyOverpayment: v })}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Efekt nadpłaty
              </span>
              <div className="grid grid-cols-2 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                {[
                  ['shortenTerm', 'Skróć okres'],
                  ['reducePayment', 'Zmniejsz ratę'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateDraft({ overpaymentMode: value as MortgageOverpaymentMode })}
                    className={`px-3 py-2 text-sm ${
                      draft.overpaymentMode === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Pojedyncze nadpłaty
              </p>
              <button
                type="button"
                onClick={addOneTimeOverpayment}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Plus size={12} /> Dodaj
              </button>
            </div>
            {draft.oneTimeOverpayments.length === 0 ? (
              <p className="text-xs text-gray-400">Brak pojedynczych nadpłat w planie.</p>
            ) : (
              <div className="space-y-2">
                {draft.oneTimeOverpayments.map(item => (
                  <div key={item.id} className="grid grid-cols-[9rem_1fr_2rem] gap-2 items-end">
                    <input
                      type="month"
                      value={item.yearMonth}
                      onChange={e => updateOneTimeOverpayment(item.id, { yearMonth: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <CurrencyInput value={item.amount} onChange={v => updateOneTimeOverpayment(item.id, { amount: v })} />
                    <button
                      type="button"
                      onClick={() => removeOneTimeOverpayment(item.id)}
                      className="h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="Usuń nadpłatę"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {mortgagePlan && (
              <button
                type="button"
                onClick={removeMortgagePlan}
                className="px-3 py-2 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Usuń hipotekę
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              disabled={draft.principal <= 0 || draft.termMonths <= 0 || draft.originalTermMonths <= 0 || !draft.name.trim()}
            >
              Zapisz plan
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Home size={16} />
            <p className="text-sm font-semibold">Podsumowanie</p>
          </div>
          {summary ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-gray-500">Rata bazowa</span><span className="font-semibold tabular-nums">{formatPLN(summary.baseMonthlyPayment)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Start minął</span><span className="font-semibold tabular-nums">{summary.elapsedMonths} mies.</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Start kredytu</span><span className="font-semibold tabular-nums">{summary.estimatedStartMonth}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Rata po nadpłatach</span><span className="font-semibold tabular-nums">{formatPLN(summary.currentMonthlyPayment)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Okres</span><span className="font-semibold tabular-nums">{summary.remainingMonths}/{summary.originalTermMonths} mies.</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Spłata</span><span className="font-semibold tabular-nums">{summary.payoffMonth ?? 'po horyzoncie'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Skrócenie</span><span className="font-semibold tabular-nums">{summary.monthsSaved} mies.</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Oszczędność odsetek</span><span className="font-semibold tabular-nums text-green-600 dark:text-green-400">{formatPLN(summary.interestSaved)}</span></div>
              {summary.refinance && (
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Rata po refi</span><span className="font-semibold tabular-nums">{formatPLN(summary.refinance.monthlyPayment)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Różnica/mies.</span><span className={`font-semibold tabular-nums ${summary.refinance.monthlyPaymentDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatPLN(summary.refinance.monthlyPaymentDelta)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Zysk netto</span><span className={`font-semibold tabular-nums ${summary.refinance.netSavings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatPLN(summary.refinance.netSavings)}</span></div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Zapisz plan, żeby zobaczyć harmonogram.</p>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-xs text-gray-400 mb-2">
            Pełny harmonogram do spłaty kredytu; nie jest ograniczony horyzontem planera.
          </p>
          <table className="w-max min-w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Miesiąc</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Rata</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Odsetki</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Kapitał</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Nadpłata</th>
                <th className="text-right py-2 pl-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.yearMonth} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatYearMonth(entry.yearMonth)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">{formatPLN(entry.payment)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-orange-600 dark:text-orange-400">{formatPLN(entry.interest)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-blue-600 dark:text-blue-400">{formatPLN(entry.principalPaid)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-green-600 dark:text-green-400">{formatPLN(entry.overpayment)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-700 dark:text-gray-300">{formatPLN(entry.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
