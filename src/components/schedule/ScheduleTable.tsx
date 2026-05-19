import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'
import { AlertTriangle, RefreshCw } from 'lucide-react'

function InlineEdit({
  value,
  onCommit,
}: {
  value: number
  onCommit: (v: number) => void
}) {
  return (
    <input
      type="number"
      defaultValue={value}
      onBlur={e => {
        const v = parseFloat(e.target.value)
        if (!isNaN(v) && v >= 0) onCommit(v)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="w-24 text-right px-1 py-0.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )
}

export function ScheduleTable() {
  const goals = useStore(s => s.goals)
  const settings = useStore(s => s.settings)
  const overrides = useStore(s => s.overrides)
  const setOverride = useStore(s => s.setOverride)
  const clearOverride = useStore(s => s.clearOverride)
  const getSchedule = useStore(s => s.getSchedule)

  const schedule = getSchedule()
  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

  if (goals.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Dodaj cele żeby zobaczyć harmonogram</p>
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Miesiąc</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Dochód</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Koszty</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Wolne</th>
            {sortedGoals.map(g => (
              <th key={g.id} className="text-right py-2 px-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap max-w-28">
                <span className="block truncate max-w-24" title={g.name}>{g.name}</span>
                <span className="font-normal text-gray-400">saldo</span>
              </th>
            ))}
            <th className="py-2 pl-2 w-6" />
          </tr>
        </thead>
        <tbody>
          {schedule.rows.map(row => {
            const hasOverride = !!overrides[row.yearMonth]

            return (
              <tr
                key={row.yearMonth}
                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  row.isDeficit ? 'bg-red-50 dark:bg-red-900/10' : ''
                }`}
              >
                <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {row.label}
                  {hasOverride && (
                    <span className="ml-1 text-orange-500" title="Niestandardowe wartości">*</span>
                  )}
                </td>

                {/* Income — editable */}
                <td className="py-1.5 px-2 text-right">
                  <InlineEdit
                    value={row.income}
                    onCommit={v => setOverride(row.yearMonth, { income: v })}
                  />
                </td>

                {/* Expenses — editable */}
                <td className="py-1.5 px-2 text-right">
                  <InlineEdit
                    value={row.expenses}
                    onCommit={v => setOverride(row.yearMonth, { expenses: v })}
                  />
                </td>

                {/* Free cash */}
                <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${
                  row.isDeficit ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                }`}>
                  {row.isDeficit && <AlertTriangle size={10} className="inline mr-0.5" />}
                  {formatPLN(row.freeCash)}
                </td>

                {/* Per-goal balances */}
                {sortedGoals.map(goal => {
                  const alloc = row.goalAllocations.find(a => a.goalId === goal.id)
                  return (
                    <td key={goal.id} className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {alloc ? (
                        <span className={alloc.isComplete ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                          {formatPLN(alloc.balanceAfter)}
                        </span>
                      ) : '—'}
                    </td>
                  )
                })}

                {/* Reset override */}
                <td className="py-1.5 pl-2">
                  {hasOverride && (
                    <button
                      onClick={() => clearOverride(row.yearMonth)}
                      className="text-gray-300 dark:text-gray-600 hover:text-orange-500 transition-colors"
                      title="Przywróć wartości domyślne"
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
      <p className="text-xs text-gray-400 mt-2">
        * = niestandardowe wartości na ten miesiąc. Kliknij <RefreshCw size={10} className="inline" /> żeby przywrócić.
        Edytuj komórki Dochód/Koszty i wciśnij Enter lub kliknij poza polem.
      </p>
    </div>
  )
}
