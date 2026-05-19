import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'
import { CurrencyInput } from '../ui/CurrencyInput'
import { TrendingUp, AlertTriangle } from 'lucide-react'

export function Hero() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const updateSettings = useStore(s => s.updateSettings)
  const getSchedule = useStore(s => s.getSchedule)

  const schedule = getSchedule()
  const freeCash = settings.monthlyIncome - settings.monthlyExpenses
  const isDeficit = freeCash < 0

  // Most urgent incomplete goal
  const firstIncomplete = schedule.goalProgress.find(g => !g.isComplete)

  const completedCount = schedule.goalProgress.filter(g => g.isComplete).length
  const totalGoals = schedule.goalProgress.length

  return (
    <div className="space-y-6">
      {/* Deficit alert */}
      {isDeficit && (
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
          onChange={v => updateSettings({ monthlyIncome: v })}
        />
        <CurrencyInput
          label="Koszty miesięczne"
          value={settings.monthlyExpenses}
          onChange={v => updateSettings({ monthlyExpenses: v })}
        />
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
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{gp.name}</p>
                    {gp.deadlineMissed && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={12} />
                        Nie zdążysz na czas
                      </p>
                    )}
                  </div>
                  {gp.isComplete ? (
                    <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Osiągnięty!
                    </span>
                  ) : gp.completionMonth ? (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ~{gp.completionMonth}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 whitespace-nowrap">Brak ETA</span>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{formatPLN(gp.currentBalance)}</span>
                    <span>{formatPLN(gp.targetAmount)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
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
