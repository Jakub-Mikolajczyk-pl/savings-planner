import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, Sparkles } from 'lucide-react'
import { reconciliationApi } from '../../api/client'
import { IS_API_MODE } from '../../config'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { SnapshotSuggestion } from '../../domain/types'

/*
 * Auto-snapshoty: zamiast ręcznie przepisywać salda, backend proponuje
 * "ostatni snapshot + delta z transakcji". Jeden klik zatwierdza.
 * Konta bez ingestu (broker, gotówka) po prostu nie dostają propozycji.
 */
export function SnapshotSuggestionsPanel({
  yearMonth,
  onAccept,
}: {
  yearMonth: string
  onAccept: (accountId: string, yearMonth: string, balance: number) => void
}) {
  const [suggestions, setSuggestions] = useState<SnapshotSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSuggestions = useCallback(
    () => reconciliationApi.snapshotSuggestions(yearMonth).catch(() => [] as SnapshotSuggestion[]),
    [yearMonth],
  )

  useEffect(() => {
    if (!IS_API_MODE || !/^\d{4}-\d{2}$/.test(yearMonth)) return
    let cancelled = false
    fetchSuggestions().then(data => {
      if (!cancelled) setSuggestions(data)
    })
    return () => { cancelled = true }
  }, [fetchSuggestions, yearMonth])

  const manualRefresh = () => {
    setLoading(true)
    fetchSuggestions()
      .then(setSuggestions)
      .finally(() => setLoading(false))
  }

  if (!IS_API_MODE || suggestions.length === 0) return null

  const accept = (suggestion: SnapshotSuggestion) => {
    onAccept(suggestion.accountId, suggestion.yearMonth, suggestion.suggestedBalance)
    setSuggestions(current => current.filter(item => item.accountId !== suggestion.accountId))
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-sky-600 dark:text-sky-300" />
          <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            Propozycje sald za {formatYearMonth(yearMonth)}
          </h2>
        </div>
        <button
          type="button"
          onClick={manualRefresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 px-2.5 py-1 text-xs text-sky-700 transition-colors hover:bg-sky-100/60 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </div>
      <p className="mt-1 text-xs text-sky-800/70 dark:text-sky-300/70">
        Wyliczone z transakcji: ostatnie znane saldo + wpływy i wydatki do końca miesiąca.
        Kliknięcie zapisuje snapshot — możesz go potem ręcznie poprawić w tabeli.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map(suggestion => (
          <div key={suggestion.accountId} className="flex items-center justify-between gap-3 rounded-md border border-sky-200/70 bg-white px-3 py-2 dark:border-sky-900/60 dark:bg-gray-900">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.accountName}</p>
              <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {suggestion.baseYearMonth
                  ? `${formatPLN(suggestion.baseBalance)} (${formatYearMonth(suggestion.baseYearMonth)}) ${suggestion.transactionsDelta >= 0 ? '+' : '−'} ${formatPLN(Math.abs(suggestion.transactionsDelta))}`
                  : `suma ${suggestion.transactionCount} transakcji`}
              </p>
              <p className="text-sm font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                {formatPLN(suggestion.suggestedBalance)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => accept(suggestion)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
            >
              <Check size={13} />
              Przyjmij
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
