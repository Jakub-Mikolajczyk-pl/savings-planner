import { CalendarClock, CreditCard, ReceiptText } from 'lucide-react'
import { useMemo } from 'react'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import { buildNextCycleForecast } from '../../domain/nextCycleForecast'
import { useStore } from '../../store'

export function NextCycleForecast() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const overrides = useStore(s => s.overrides)
  const forecast = useMemo(
    () => buildNextCycleForecast(settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const freeCashNegative = forecast.freeCashAfterCreditCard < 0
  const activeLines = forecast.lines.filter(line => line.amount > 0 || line.key === 'creditCard')

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="rounded-md border border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatYearMonth(forecast.targetMonth)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kolejny cykl po {formatYearMonth(forecast.currentMonth)}
            </p>
          </div>
          <CalendarClock size={17} className="mt-0.5 text-gray-400" />
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Do zapłaty</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
            {formatPLN(forecast.totalRequired)}
          </p>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <ForecastMetric label="Przychód" value={forecast.income} />
          <ForecastMetric label="Wolne bez karty" value={forecast.freeCashBeforeCreditCard} />
          <ForecastMetric
            label="Po spłacie karty"
            value={forecast.freeCashAfterCreditCard}
            tone={freeCashNegative ? 'negative' : 'positive'}
          />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <ReceiptText size={16} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Składniki prognozy</p>
          </div>
          {forecast.creditCardPayment > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <CreditCard size={13} />
              karta {formatPLN(forecast.creditCardPayment)}
            </span>
          )}
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {activeLines.map(line => (
            <div key={line.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-800 dark:text-gray-200">{line.label}</p>
                {line.detail && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{line.detail}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatPLN(line.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ForecastMetric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-gray-900 dark:text-gray-100'

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{formatPLN(value)}</span>
    </div>
  )
}
