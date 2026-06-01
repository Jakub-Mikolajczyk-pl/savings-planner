import { useMemo, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { formatPLN } from '../../domain/formatting'
import { periodKey } from '../../domain/payPeriods'
import { useStore } from '../../store'
import { Collapsible } from '../ui/Collapsible'

interface Props {
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
}

export function PayPeriodsSection({ selectedKey: controlledSelectedKey, onSelectedKeyChange }: Props = {}) {
  const incomeAnchors = useStore(s => s.incomeAnchors)
  const candidates = useStore(s => s.incomeAnchorCandidates)
  const payPeriods = useStore(s => s.payPeriods)
  const settings = useStore(s => s.payPeriodSettings)
  const addIncomeAnchor = useStore(s => s.addIncomeAnchor)
  const removeIncomeAnchor = useStore(s => s.removeIncomeAnchor)
  const refreshPayPeriods = useStore(s => s.refreshPayPeriods)
  const updatePayPeriodSettings = useStore(s => s.updatePayPeriodSettings)
  const [localSelectedKey, setLocalSelectedKey] = useState('')
  const [lastRefresh, setLastRefresh] = useState<string | undefined>()
  const selectedKey = controlledSelectedKey ?? localSelectedKey

  const selectedPeriod = useMemo(
    () => payPeriods.find(period => periodKey(period) === selectedKey) ?? payPeriods[0],
    [payPeriods, selectedKey],
  )

  const selectPeriod = (key: string) => {
    setLocalSelectedKey(key)
    onSelectedKeyChange?.(key)
  }

  const saveSettings = (rawValue: string) => {
    const parsed = Number(rawValue)
    const next = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : settings.minCycleDays
    void updatePayPeriodSettings({ minCycleDays: next })
  }

  const runRefresh = async () => {
    const result = await refreshPayPeriods()
    setLastRefresh(`${result.periods} cykli`)
  }

  if (!IS_API_MODE) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Cykle od wyplaty do wyplaty sa dostepne w trybie API.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-3 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-3">
          <Metric label="Kotwice" value={String(incomeAnchors.length)} />
          <Metric label="Cykle" value={String(payPeriods.length)} />
          <Metric label="Guard" value={`${settings.minCycleDays} dni`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            Min. dni
            <input
              type="number"
              min={1}
              key={settings.minCycleDays}
              defaultValue={settings.minCycleDays}
              onBlur={event => saveSettings(event.target.value)}
              className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <button
            type="button"
            onClick={runRefresh}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Przelicz
          </button>
        </div>
      </div>
      {lastRefresh && <p className="text-xs text-gray-500 dark:text-gray-400">Ostatnie przeliczenie: {lastRefresh}</p>}

      <Collapsible title="Wybrany cykl" defaultOpen badge={selectedPeriod ? selectedPeriodLabel(selectedPeriod) : 'brak'}>
        {selectedPeriod ? (
          <div className="space-y-3">
            <select
              value={periodKey(selectedPeriod)}
              onChange={event => selectPeriod(event.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              {payPeriods.map(period => (
                <option key={periodKey(period)} value={periodKey(period)}>
                  {period.accountName} - {selectedPeriodLabel(period)}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric label="Wplyw" value={formatPLN(selectedPeriod.income)} tone="positive" />
              <Metric label="Wydatek" value={formatPLN(selectedPeriod.expense)} tone="negative" />
              <Metric label="Netto" value={formatPLN(selectedPeriod.net)} tone={selectedPeriod.net < 0 ? 'negative' : 'positive'} />
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            Dodaj kotwice przychodu, zeby wyznaczyc cykle.
          </p>
        )}
      </Collapsible>

      <Collapsible title="Kandydaci kotwic" defaultOpen badge={String(candidates.length)}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-3 font-medium">Konto</th>
                <th className="py-2 pr-3 font-medium">Kontrahent</th>
                <th className="py-2 pr-3 text-right font-medium">Liczba</th>
                <th className="py-2 pr-3 text-right font-medium">Suma</th>
                <th className="py-2 pr-3 font-medium">Zakres</th>
                <th className="py-2 pr-0" />
              </tr>
            </thead>
            <tbody>
              {candidates.map(candidate => (
                <tr key={`${candidate.accountId}-${candidate.counterparty}`} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-3">{candidate.accountName}</td>
                  <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{candidate.counterparty}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{candidate.transactionCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-teal-700 dark:text-teal-300">{formatPLN(candidate.totalIncome)}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500 dark:text-gray-400">{candidate.firstBookedAt} - {candidate.lastBookedAt}</td>
                  <td className="py-2 pr-0 text-right">
                    <button
                      type="button"
                      disabled={candidate.alreadyAnchored}
                      onClick={() => void addIncomeAnchor(candidate.accountId, candidate.counterparty)}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {candidate.alreadyAnchored ? 'Aktywna' : 'Ustaw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>

      <Collapsible title="Aktywne kotwice" badge={String(incomeAnchors.length)}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {incomeAnchors.map(anchor => (
            <div key={anchor.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{anchor.counterparty}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{anchor.accountName}</p>
              </div>
              <button
                type="button"
                onClick={() => void removeIncomeAnchor(anchor.id)}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-red-600 dark:hover:bg-gray-800"
                aria-label={`Usun kotwice ${anchor.counterparty}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive'
    ? 'text-teal-700 dark:text-teal-300'
    : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-gray-900 dark:text-gray-100'

  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

function selectedPeriodLabel(period: { periodStart: string; periodEnd?: string; isPartial: boolean }) {
  return `${period.periodStart} - ${period.periodEnd ?? 'teraz'}${period.isPartial ? ' (czesciowy)' : ''}`
}
