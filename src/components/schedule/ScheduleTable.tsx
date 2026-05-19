import { useMemo } from 'react'
import { useStore } from '../../store'
import { buildSchedule } from '../../domain/allocation'
import { formatPLN } from '../../domain/formatting'
import { AlertTriangle, RefreshCw } from 'lucide-react'

function InlineNumberEdit({
  value,
  onCommit,
  className = '',
}: {
  value: number
  onCommit: (v: number) => void
  className?: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      defaultValue={value}
      key={value}
      onFocus={e => e.target.select()}
      onChange={e => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        e.target.value = digits ? parseInt(digits, 10).toLocaleString('pl-PL') : ''
      }}
      onBlur={e => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        const v = digits ? parseInt(digits, 10) : value
        onCommit(v)
        e.target.value = v.toLocaleString('pl-PL')
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-20 text-right px-1 py-0.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  )
}

export function ScheduleTable() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const overrides = useStore(s => s.overrides)
  const setOverride = useStore(s => s.setOverride)
  const setGoalAllocationOverride = useStore(s => s.setGoalAllocationOverride)
  const clearOverride = useStore(s => s.clearOverride)

  const schedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides),
    [settings, goals, loans, overrides],
  )
  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

  if (goals.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Dodaj cele żeby zobaczyć harmonogram</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900 z-10">
              Miesiąc
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Dochód</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Koszty</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Wolne</th>

            {/* Per-goal: two columns each */}
            {sortedGoals.map(g => (
              <th
                key={g.id}
                colSpan={2}
                className="text-center py-2 px-2 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap border-l border-gray-100 dark:border-gray-800"
              >
                <span className="block max-w-32 truncate" title={g.name}>{g.name}</span>
                <span className="flex gap-4 text-[10px] font-normal text-gray-400 justify-center mt-0.5">
                  <span>alokacja</span>
                  <span>saldo</span>
                </span>
              </th>
            ))}

            <th className="py-2 pl-2 w-6" />
          </tr>
        </thead>
        <tbody>
          {schedule.rows.map(row => {
            const override = overrides[row.yearMonth]
            const hasOverride = !!(override && (
              override.income !== undefined ||
              override.expenses !== undefined ||
              (override.perGoalAllocation && Object.keys(override.perGoalAllocation).length > 0)
            ))

            return (
              <tr
                key={row.yearMonth}
                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  row.isDeficit ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                }`}
              >
                {/* Month label — sticky */}
                <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">
                  {row.label}
                  {hasOverride && (
                    <span className="ml-1 text-orange-400" title="Niestandardowe wartości">*</span>
                  )}
                </td>

                {/* Income */}
                <td className="py-1.5 px-2 text-right">
                  <InlineNumberEdit
                    value={row.income}
                    onCommit={v => setOverride(row.yearMonth, { income: v })}
                  />
                </td>

                {/* Expenses */}
                <td className="py-1.5 px-2 text-right">
                  <InlineNumberEdit
                    value={row.expenses}
                    onCommit={v => setOverride(row.yearMonth, { expenses: v })}
                  />
                </td>

                {/* Free cash */}
                <td className={`py-1.5 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                  row.isDeficit
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400'
                }`}>
                  {row.isDeficit && <AlertTriangle size={10} className="inline mr-0.5" />}
                  {formatPLN(row.freeCash)}
                </td>

                {/* Per-goal: allocation (editable) + saldo */}
                {sortedGoals.map(goal => {
                  const alloc = row.goalAllocations.find(a => a.goalId === goal.id)
                  const isOverridden = !!(override?.perGoalAllocation?.[goal.id] !== undefined)

                  return [
                    // Allocation cell — editable
                    <td
                      key={`alloc-${goal.id}`}
                      className="py-1.5 px-2 text-right border-l border-gray-100 dark:border-gray-800"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {isOverridden && (
                          <button
                            onClick={() => setGoalAllocationOverride(row.yearMonth, goal.id, null)}
                            className="text-gray-300 dark:text-gray-600 hover:text-orange-400 transition-colors"
                            title="Usuń nadpisanie alokacji"
                          >
                            <RefreshCw size={10} />
                          </button>
                        )}
                        <InlineNumberEdit
                          value={alloc?.allocated ?? 0}
                          onCommit={v => setGoalAllocationOverride(row.yearMonth, goal.id, v)}
                          className={isOverridden ? 'border-orange-300 dark:border-orange-700' : ''}
                        />
                      </div>
                    </td>,

                    // Saldo cell — read-only
                    <td
                      key={`saldo-${goal.id}`}
                      className={`py-1.5 px-3 text-right tabular-nums whitespace-nowrap ${
                        alloc?.isComplete
                          ? 'text-green-600 dark:text-green-400 font-semibold'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {alloc !== undefined ? formatPLN(alloc.balanceAfter) : '—'}
                    </td>,
                  ]
                })}

                {/* Reset row override */}
                <td className="py-1.5 pl-2">
                  {hasOverride && (
                    <button
                      onClick={() => clearOverride(row.yearMonth)}
                      className="text-gray-300 dark:text-gray-600 hover:text-orange-400 transition-colors"
                      title="Przywróć wszystkie wartości domyślne tego miesiąca"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-xs text-gray-400 mt-3 space-y-0.5">
        <span className="block">
          * = nadpisane wartości. Kliknij <RefreshCw size={10} className="inline" /> przy alokacji żeby usunąć override celu, lub przy miesiącu żeby zresetować cały wiersz.
        </span>
        <span className="block text-gray-300 dark:text-gray-600">
          Kolumna "alokacja" — wpisz kwotę żeby zablokować ile idzie na dany cel w tym miesiącu. Reszta wolnych środków trafi do pozostałych celów normalnie.
        </span>
      </p>
    </div>
  )
}
