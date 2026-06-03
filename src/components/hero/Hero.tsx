import { useMemo } from 'react'
import { useStore } from '../../store'
import { buildSchedule } from '../../domain/allocation'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'
import { TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export function Hero() {
  /*
   * Hero jest komponentem "derived UI":
   * nie trzyma własnego stanu domenowego, tylko bierze dane ze store i liczy
   * wartości do pokazania.
   */
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const overrides = useStore(s => s.overrides)
  const updateSettings = useStore(s => s.updateSettings)

  const schedule = useMemo(
    /*
     * buildSchedule jest pure function z domeny.
     * React komponent nie powinien mieć logiki finansowej w JSX; komponent
     * tylko woła domenę i renderuje wynik.
     *
     * Angular porównanie:
     * To podobne do przeniesienia ciężkiej logiki z template do service/pure function.
     */
    () => buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const firstMonth = schedule.rows[0]
  const totalLoanPayments = firstMonth?.loanPaymentsTotal ?? 0
  const mortgagePayment = firstMonth?.mortgagePaymentTotal ?? 0
  const totalDebtPayments = totalLoanPayments + mortgagePayment
  const subscriptionsTotal = firstMonth?.subscriptionsTotal ?? 0
  const oneTimeExpensesTotal = firstMonth?.oneTimeExpensesTotal ?? 0
  const livingExpenses = firstMonth?.expenses ?? settings.monthlyExpenses
  const totalMonthlyCosts = livingExpenses + subscriptionsTotal + oneTimeExpensesTotal + totalDebtPayments
  const freeCash = firstMonth?.freeCash ?? settings.monthlyIncome - settings.monthlyExpenses - totalDebtPayments
  const isDeficit = freeCash < 0

  /*
   * Zmiennych pomocniczych nie trzeba wkładać do useMemo automatycznie.
   * Proste obliczenia z wyniku schedule są tanie i czytelniejsze jako zwykłe const.
   */
  const completedCount = schedule.goalProgress.filter(g => g.isComplete).length
  const totalGoals = schedule.goalProgress.length

  return (
    <div className="space-y-6">
      {/* Deficit alert */}
      {isDeficit && (
        /*
         * Warunkowy alert.
         * React renderuje false/null/undefined jako "nic".
         */
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">
            Deficyt {formatPLN(Math.abs(freeCash))}/mies. — koszty przewyższają dochód
          </span>
        </div>
      )}

      {/* Quick edit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CurrencyInput
          label="Dochód miesięczny"
          value={settings.monthlyIncome}
          /*
           * updateSettings przyjmuje patch.
           * Komponent nie musi znać całego Settings, tylko zmieniane pole.
           */
          onChange={v => updateSettings({ monthlyIncome: v })}
        />
        <div className="flex flex-col gap-1">
          <CurrencyInput
            label="Koszty miesięczne"
            value={settings.monthlyExpenses}
            onChange={v => updateSettings({ monthlyExpenses: v })}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
            Wydatki życiowe bez abonamentów
          </p>
          <div className="mt-1 rounded-md border border-gray-200 px-2.5 py-2 dark:border-gray-700">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Koszty łącznie</span>
              <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatPLN(totalMonthlyCosts)}/mies.
              </span>
            </div>
          </div>
          {subscriptionsTotal > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex justify-between px-1">
              <span>+ abonamenty</span>
              <span className="tabular-nums text-sky-600 dark:text-sky-400">
                +{formatPLN(subscriptionsTotal)}/mc
              </span>
            </p>
          )}
          {oneTimeExpensesTotal > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex justify-between px-1">
              <span>+ jednorazowe w tym miesiącu</span>
              <span className="tabular-nums text-purple-600 dark:text-purple-400">
                +{formatPLN(oneTimeExpensesTotal)}
              </span>
            </p>
          )}
          {totalDebtPayments > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex justify-between px-1">
              <span>+ raty kredytów</span>
              <span className="tabular-nums text-orange-500 dark:text-orange-400">
                +{formatPLN(totalDebtPayments)}/mies.
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Wolne środki
          </label>
          <div className={`px-3 py-2 rounded-lg border text-right tabular-nums font-semibold ${
            isDeficit
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          }`}>
            {formatPLN(freeCash)}/mies.
          </div>
          {(subscriptionsTotal > 0 || oneTimeExpensesTotal > 0 || totalDebtPayments > 0) && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1 text-right">
              po bazie ({formatPLN(settings.monthlyExpenses)}), abonamentach ({formatPLN(subscriptionsTotal)}), jednorazowych ({formatPLN(oneTimeExpensesTotal)}) i ratach ({formatPLN(totalDebtPayments)})
            </p>
          )}
        </div>
      </div>

      {/* Goal progress cards */}
      {goals.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Brak celów</p>
          <p className="text-sm mt-1">Dodaj pierwszy cel w sekcji "Cele" poniżej</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedule.goalProgress.map((gp, i) => {
            /*
             * map callback może zawierać zwykłą logikę JS przed return JSX.
             * To jedna z dużych różnic względem Angular templates:
             * w React JSX i JS żyją w tym samym pliku i zakresie.
             */
            const pct = Math.min(100, (gp.currentBalance / gp.targetAmount) * 100)
            const isFirst = i === 0 && !gp.isComplete

            return (
              <div
                key={gp.goalId}
                className={`rounded-xl border p-4 space-y-3 ${
                  isFirst
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                    : gp.isComplete
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{gp.name}</p>
                    {/* Deadline row */}
                    {gp.deadline && (
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${
                        gp.deadlineMissed
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {gp.deadlineMissed
                          ? <AlertTriangle size={11} />
                          : <Clock size={11} />}
                        Deadline: {formatYearMonth(gp.deadline)}
                        {gp.deadlineMissed && ' — nie zdążysz!'}
                        {gp.deadlineOnTime && ' ✓'}
                      </p>
                    )}
                  </div>
                  {/* Completion badge */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {gp.isComplete && gp.deadlineOnTime && (
                      <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Osiągnięty na czas!
                      </span>
                    )}
                    {gp.isComplete && !gp.deadline && (
                      <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                        Osiągnięty!
                      </span>
                    )}
                    {gp.isComplete && gp.deadlineMissed && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                        Osiągnięty za późno
                      </span>
                    )}
                    {!gp.isComplete && (gp.completionMonth || gp.projectedETA) && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        gp.deadlineMissed
                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      }`}
                        title={gp.projectedETA && !gp.completionMonth ? 'Prognoza poza horyzontem kalkulacji' : undefined}
                      >
                        ~{gp.completionMonth ?? gp.projectedETA}{gp.projectedETA && !gp.completionMonth ? ' *' : ''}
                      </span>
                    )}
                    {!gp.isComplete && !gp.completionMonth && !gp.projectedETA && (
                      <span className="text-xs text-gray-400">brak alokacji</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{formatPLN(gp.currentBalance)}</span>
                    <span>{formatPLN(gp.targetAmount)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      /*
                       * style prop przyjmuje obiekt JS, nie string CSS.
                       * Nazwy właściwości są camelCase, np. backgroundColor.
                       */
                      className={`h-full rounded-full transition-all duration-500 ${
                        gp.isComplete ? 'bg-green-500' : isFirst ? 'bg-blue-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">{pct.toFixed(0)}%</p>
                </div>

                {gp.deadlineMissed && gp.shortfallPerMonth && gp.shortfallPerMonth > 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Potrzebujesz +{formatPLN(gp.shortfallPerMonth)}/mies. żeby zdążyć
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalGoals > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {completedCount} z {totalGoals} {totalGoals === 1 ? 'celu osiągniętego' : 'celów osiągniętych'}
        </p>
      )}
    </div>
  )
}
