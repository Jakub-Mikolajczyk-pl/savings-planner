import { useEffect, useMemo } from 'react'
import { AlertTriangle, Scale } from 'lucide-react'
import { useStore } from '../../store'
import { IS_API_MODE } from '../../config'
import { buildReconciliationRows, type DriftLevel, type ReconciliationMetric } from '../../domain/reconciliation'
import { formatPLN } from '../../domain/formatting'

const levelClass: Record<DriftLevel, string> = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  alert: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300',
}

/*
 * Plan vs wykonanie — most między harmonogramem a transakcjami bankowymi.
 * Pokazuje, czy rzeczywistość trzyma się planu, zanim user zauważy to na saldzie.
 */
export function ReconciliationSection() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const overrides = useStore(s => s.overrides)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const monthlyActuals = useStore(s => s.monthlyActuals)
  const loadMonthlyActuals = useStore(s => s.loadMonthlyActuals)
  const hasHydratedFromBackend = useStore(s => s.hasHydratedFromBackend)

  useEffect(() => {
    if (IS_API_MODE && hasHydratedFromBackend && monthlyActuals === undefined) {
      void loadMonthlyActuals(6)
    }
  }, [hasHydratedFromBackend, monthlyActuals, loadMonthlyActuals])

  const rows = useMemo(
    () => buildReconciliationRows(settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses, monthlyActuals ?? []),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses, monthlyActuals],
  )

  if (!IS_API_MODE) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Porównanie planu z rzeczywistością wymaga trybu API (transakcje z banku żyją w backendzie).
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Brak transakcji w ostatnich miesiącach. Zaimportuj wyciąg w zakładce Transakcje,
        a tu zobaczysz, czy rzeczywistość trzyma się planu.
      </p>
    )
  }

  const newestFirst = [...rows].reverse()

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 pr-3">Miesiąc</th>
              <th className="px-2 py-2 text-right">Przychody</th>
              <th className="px-2 py-2 text-right">Wydatki</th>
              <th className="px-2 py-2 text-right">Oszczędzanie</th>
              <th className="py-2 pl-2 text-right">Bez kategorii</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {newestFirst.map(row => (
              <tr key={row.yearMonth}>
                <td className="py-2.5 pr-3 align-top whitespace-nowrap">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{row.label}</span>
                  {row.isPartial && (
                    <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      w toku
                    </span>
                  )}
                </td>
                <MetricCell metric={row.income} muted={row.isPartial} />
                <MetricCell metric={row.expenses} muted={row.isPartial} />
                <MetricCell metric={row.savings} muted={row.isPartial} />
                <td className="py-2.5 pl-2 text-right align-top">
                  {row.uncategorizedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={12} />
                      {row.uncategorizedCount}/{row.transactionCount}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">0/{row.transactionCount}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Scale size={13} className="mt-0.5 shrink-0" />
        Plan liczony tym samym silnikiem co harmonogram (z nadpisaniami, abonamentami i ratami).
        Wykonanie z transakcji: transfery własne pominięte, wpłaty na oszczędności liczą się
        jako oszczędzanie, nie wydatek. Miesiąc „w toku” jeszcze się nie domknął.
      </p>
    </div>
  )
}

function MetricCell({ metric, muted }: { metric: ReconciliationMetric; muted: boolean }) {
  return (
    <td className="px-2 py-2.5 text-right align-top whitespace-nowrap">
      <span className="block tabular-nums font-medium text-gray-900 dark:text-gray-100">{formatPLN(metric.actual)}</span>
      <span className="block text-xs tabular-nums text-gray-400 dark:text-gray-500">plan {formatPLN(metric.planned)}</span>
      {metric.driftPct !== undefined && !muted && (
        <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${levelClass[metric.level]}`}>
          {metric.driftPct >= 0 ? '+' : ''}{metric.driftPct}%
        </span>
      )}
    </td>
  )
}
