import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import { useStore } from '../../store'
import { buildSchedule } from '../../domain/allocation'
import { formatPLN, formatYearMonth } from '../../domain/formatting'

const GOAL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
const LOAN_COLORS = ['#ef4444', '#f97316', '#dc2626', '#ea580c']
// What-if goal lines in neutral gray — clearly distinct from goal colors
const WHATIF_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#d1d5db', '#e5e7eb']

interface ChartPoint {
  label: string
  [key: string]: string | number
}

export function SavingsChart() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const overrides = useStore(s => s.overrides)
  const whatIfDelta = useStore(s => s.whatIfDelta)
  const loanOverpayment = useStore(s => s.loanOverpayment)
  const goalInsights = useStore(s => s.goalInsights)

  const schedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const whatIfSchedule = useMemo(
    () => buildSchedule(
      settings,
      goals,
      loans,
      overrides,
      whatIfDelta,
      loanOverpayment,
      mortgagePlan,
      subscriptions,
      upcomingExpenses,
    ),
    [settings, goals, loans, overrides, whatIfDelta, loanOverpayment, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

  const hasWhatIf = whatIfDelta !== 0 || loanOverpayment > 0
  const visibleMonths = new Set(schedule.rows.map(row => row.yearMonth))
  const upcomingMarkers = upcomingExpenses
    .filter(expense => !expense.isPaid && visibleMonths.has(expense.targetMonth))
    .sort((a, b) => a.targetMonth.localeCompare(b.targetMonth))

  if (goals.length === 0 && loans.length === 0 && upcomingMarkers.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Dodaj cele lub kredyty żeby zobaczyć wykres</p>
  }

  const data: ChartPoint[] = schedule.rows.map((row, i) => {
    const point: ChartPoint = { label: row.label }

    // Goal balances (actual + what-if)
    sortedGoals.forEach(goal => {
      const alloc = row.goalAllocations.find(a => a.goalId === goal.id)
      point[`goal_${goal.id}`] = alloc?.balanceAfter ?? 0
      const wi = whatIfSchedule.rows[i]?.goalAllocations.find(a => a.goalId === goal.id)
      point[`wi_goal_${goal.id}`] = wi?.balanceAfter ?? 0
    })

    // Loan balances (actual + what-if with overpayment)
    loans.forEach(loan => {
      const entry = row.loanEntries.find(e => e.loanId === loan.id)
      point[`loan_${loan.id}`] = entry?.balanceAfter ?? 0
      const wiEntry = whatIfSchedule.rows[i]?.loanEntries.find(e => e.loanId === loan.id)
      point[`wi_loan_${loan.id}`] = wiEntry?.balanceAfter ?? 0
    })

    return point
  })

  const tickInterval = Math.max(1, Math.floor(data.length / 12))
  // What-if summary: goal ETA deltas + loan payoff deltas
  const goalSummary = sortedGoals.map((goal, i) => {
    const base = schedule.goalProgress.find(g => g.goalId === goal.id)
    const wi = whatIfSchedule.goalProgress.find(g => g.goalId === goal.id)
    const baseETA = base?.completionMonth ?? base?.projectedETA
    const wiETA = wi?.completionMonth ?? wi?.projectedETA
    if (!baseETA || !wiETA || baseETA === wiETA) return null
    const [by, bm] = baseETA.split('-').map(Number)
    const [wy, wm] = wiETA.split('-').map(Number)
    const delta = (wy - by) * 12 + (wm - bm)
    const sign = delta < 0 ? '−' : '+'
    return { name: goal.name, color: GOAL_COLORS[i % GOAL_COLORS.length], delta: Math.abs(delta), sign, type: 'goal' as const }
  }).filter(Boolean)

  const loanSummary = loans.map((loan, i) => {
    const base = schedule.loanProgress.find(lp => lp.loanId === loan.id)
    const wi = whatIfSchedule.loanProgress.find(lp => lp.loanId === loan.id)
    const baseYM = base?.payoffMonth ?? base?.projectedPayoffMonth
    const wiYM = wi?.payoffMonth ?? wi?.projectedPayoffMonth
    if (!baseYM || !wiYM || baseYM === wiYM) return null
    const [by, bm] = baseYM.split('-').map(Number)
    const [wy, wm] = wiYM.split('-').map(Number)
    const delta = (by - wy) * 12 + (bm - wm)
    if (delta <= 0) return null
    return { name: loan.name, color: LOAN_COLORS[i % LOAN_COLORS.length], delta, sign: '−', type: 'loan' as const }
  }).filter(Boolean)

  const hasSummary = hasWhatIf && (goalSummary.length > 0 || loanSummary.length > 0)

  return (
    <div className="space-y-3">
      {goalInsights && goalInsights.cycleCount > 0 && (
        <div className="grid gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Realne tempo</p>
            <p className={`font-semibold tabular-nums ${goalInsights.averageNetPerCycle < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-700 dark:text-teal-300'}`}>
              {formatPLN(goalInsights.averageNetPerCycle)}/cykl
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Wolna gotowka</p>
            <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatPLN(goalInsights.averageFreeCashPerCycle)}/cykl</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Historia</p>
            <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{goalInsights.cycleCount} pelnych cykli</p>
          </div>
        </div>
      )}

      {/* What-if summary banner */}
      {hasSummary && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Efekt symulacji:</span>
          {loanSummary.map(s => s && (
            <span key={s.name} className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
              <span style={{ color: s.color }}>■</span>{' '}
              Spłata {s.name}: −{s.delta} mies.
            </span>
          ))}
          {goalSummary.map(s => s && (
            <span key={s.name} className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              s.sign === '−'
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
            }`}>
              <span style={{ color: s.color }}>■</span>{' '}
              {s.name}: {s.sign}{s.delta} mies.
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {sortedGoals.map((goal, i) => (
              <linearGradient key={goal.id} id={`grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GOAL_COLORS[i % GOAL_COLORS.length]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={GOAL_COLORS[i % GOAL_COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval - 1} className="fill-gray-500" />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11 }}
            width={40}
            className="fill-gray-500"
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              const numericValue = typeof value === 'number' ? value : Number(value ?? 0)
              const key = String(name)
              if (key.startsWith('wi_goal_')) {
                const goalId = key.replace('wi_goal_', '')
                const goal = sortedGoals.find(g => g.id === goalId)
                return [formatPLN(numericValue), `${goal?.name ?? goalId} (scenariusz)`]
              }
              if (key.startsWith('goal_')) {
                const goalId = key.replace('goal_', '')
                return [formatPLN(numericValue), sortedGoals.find(g => g.id === goalId)?.name ?? goalId]
              }
              if (key.startsWith('wi_loan_')) {
                const loanId = key.replace('wi_loan_', '')
                const loan = loans.find(l => l.id === loanId)
                return [formatPLN(value), `${loan?.name ?? loanId} (z nadpłatą)`]
              }
              if (key.startsWith('loan_')) {
                const loanId = key.replace('loan_', '')
                return [formatPLN(value), `↓ ${loans.find(l => l.id === loanId)?.name ?? loanId}`]
              }
              return [formatPLN(numericValue), key]
            }}
            contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
            labelFormatter={label => String(label ?? '')}
          />
          <Legend
            formatter={(value: string) => {
              if (value.startsWith('wi_goal_')) {
                const goalId = value.replace('wi_goal_', '')
                return `${sortedGoals.find(g => g.id === goalId)?.name ?? goalId} (scenariusz)`
              }
              if (value.startsWith('goal_')) {
                return sortedGoals.find(g => g.id === value.replace('goal_', ''))?.name ?? value
              }
              if (value.startsWith('wi_loan_')) {
                const loanId = value.replace('wi_loan_', '')
                return `${loans.find(l => l.id === loanId)?.name ?? loanId} (z nadpłatą)`
              }
              if (value.startsWith('loan_')) {
                return `↓ ${loans.find(l => l.id === value.replace('loan_', ''))?.name ?? value}`
              }
              return value
            }}
            wrapperStyle={{ fontSize: 11 }}
          />

          {/* Horizontal target reference lines — no label, color matches legend */}
          {sortedGoals.map((goal, i) => (
            <ReferenceLine
              key={`ref-${goal.id}`}
              y={goal.targetAmount}
              stroke={GOAL_COLORS[i % GOAL_COLORS.length]}
              strokeDasharray="6 3"
              strokeOpacity={0.35}
            />
          ))}

          {/* Vertical deadline lines — label at bottom, alternating left/right to avoid collisions */}
          {sortedGoals.map((goal, i) => {
            if (!goal.deadline) return null
            const gp = schedule.goalProgress.find(g => g.goalId === goal.id)
            const deadlineYM = goal.deadline.slice(0, 7)
            const color = GOAL_COLORS[i % GOAL_COLORS.length]
            const missed = gp?.deadlineMissed
            const labelColor = missed ? '#f97316' : color
            const short = goal.name.length > 10 ? goal.name.slice(0, 10) + '…' : goal.name
            return (
              <ReferenceLine
                key={`deadline-${goal.id}`}
                x={formatYearMonth(deadlineYM)}
                stroke={labelColor}
                strokeDasharray="4 2"
                strokeOpacity={0.7}
                label={{
                  value: `⏱ ${short}`,
                  fontSize: 9,
                  fill: labelColor,
                  position: i % 2 === 0 ? 'insideBottomLeft' : 'insideBottomRight',
                }}
              />
            )
          })}

          {/* Vertical loan payoff lines — label at top, alternating side */}
          {schedule.loanProgress.map((lp, i) => {
            if (!lp.payoffMonth) return null
            const color = LOAN_COLORS[i % LOAN_COLORS.length]
            const short = lp.name.length > 10 ? lp.name.slice(0, 10) + '…' : lp.name
            return (
              <ReferenceLine
                key={`payoff-${lp.loanId}`}
                x={formatYearMonth(lp.payoffMonth)}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                label={{
                  value: `✓ ${short}`,
                  fontSize: 9,
                  fill: color,
                  position: i % 2 === 0 ? 'insideTopLeft' : 'insideTopRight',
                }}
              />
            )
          })}

          {/* Goal actual areas — solid, filled */}
          {upcomingMarkers.map((expense, i) => {
            const short = expense.name.length > 10 ? `${expense.name.slice(0, 10)}...` : expense.name
            return (
              <ReferenceLine
                key={`upcoming-${expense.id}`}
                x={formatYearMonth(expense.targetMonth)}
                stroke="#9333ea"
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                label={{
                  value: `${short} ${formatPLN(expense.amount)}`,
                  fontSize: 9,
                  fill: '#9333ea',
                  position: i % 2 === 0 ? 'insideTopLeft' : 'insideBottomLeft',
                }}
              />
            )
          })}

          {sortedGoals.map((goal, i) => (
            <Area
              key={`goal_${goal.id}`}
              type="monotone"
              dataKey={`goal_${goal.id}`}
              name={`goal_${goal.id}`}
              stroke={GOAL_COLORS[i % GOAL_COLORS.length]}
              fill={`url(#grad-${goal.id})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}

          {/* Loan balance lines — solid, descending, red tones */}
          {loans.map((loan, i) => (
            <Line
              key={`loan_${loan.id}`}
              type="monotone"
              dataKey={`loan_${loan.id}`}
              name={`loan_${loan.id}`}
              stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}

          {/* What-if goal lines — gray dashed */}
          {hasWhatIf && sortedGoals.map((goal, i) => (
            <Line
              key={`wi_goal_${goal.id}`}
              type="monotone"
              dataKey={`wi_goal_${goal.id}`}
              name={`wi_goal_${goal.id}`}
              stroke={WHATIF_COLORS[i % WHATIF_COLORS.length]}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}

          {/* What-if loan lines — loan color, dashed, faster descent */}
          {loanOverpayment > 0 && loans.map((loan, i) => (
            <Line
              key={`wi_loan_${loan.id}`}
              type="monotone"
              dataKey={`wi_loan_${loan.id}`}
              name={`wi_loan_${loan.id}`}
              stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.6}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
