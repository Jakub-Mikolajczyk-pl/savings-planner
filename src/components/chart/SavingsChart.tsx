import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface ChartPoint {
  label: string
  yearMonth: string
  [goalName: string]: string | number
}

export function SavingsChart() {
  const goals = useStore(s => s.goals)
  const whatIfDelta = useStore(s => s.whatIfDelta)
  const getSchedule = useStore(s => s.getSchedule)
  const getWhatIfSchedule = useStore(s => s.getWhatIfSchedule)

  const schedule = getSchedule()
  const whatIfSchedule = whatIfDelta !== 0 ? getWhatIfSchedule() : null

  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

  if (goals.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Dodaj cele żeby zobaczyć wykres</p>
  }

  const data: ChartPoint[] = schedule.rows.map((row, i) => {
    const point: ChartPoint = { label: row.label, yearMonth: row.yearMonth }
    sortedGoals.forEach(goal => {
      const alloc = row.goalAllocations.find(a => a.goalId === goal.id)
      point[goal.name] = alloc?.balanceAfter ?? 0
      if (whatIfSchedule) {
        const wiAlloc = whatIfSchedule.rows[i]?.goalAllocations.find(a => a.goalId === goal.id)
        point[`${goal.name}_whatif`] = wiAlloc?.balanceAfter ?? 0
      }
    })
    return point
  })

  // Show only every Nth label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {sortedGoals.map((goal, i) => (
              <linearGradient key={goal.id} id={`grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval={tickInterval - 1}
            className="fill-gray-500"
          />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11 }}
            className="fill-gray-500"
            width={40}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const isWhatIf = name.endsWith('_whatif')
              const displayName = isWhatIf ? `${name.replace('_whatif', '')} (what-if)` : name
              return [formatPLN(value), displayName]
            }}
            contentStyle={{
              fontSize: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
          <Legend
            formatter={(value: string) =>
              value.endsWith('_whatif') ? `${value.replace('_whatif', '')} (what-if)` : value
            }
            wrapperStyle={{ fontSize: 12 }}
          />

          {/* Target reference lines */}
          {sortedGoals.map((goal, i) => (
            <ReferenceLine
              key={goal.id}
              y={goal.targetAmount}
              stroke={COLORS[i % COLORS.length]}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
              label={{ value: `Cel: ${goal.name}`, fontSize: 10, fill: COLORS[i % COLORS.length] }}
            />
          ))}

          {/* Actual balance areas */}
          {sortedGoals.map((goal, i) => (
            <Area
              key={goal.id}
              type="monotone"
              dataKey={goal.name}
              stroke={COLORS[i % COLORS.length]}
              fill={`url(#grad-${goal.id})`}
              strokeWidth={2}
              dot={false}
            />
          ))}

          {/* What-if lines (dashed, no fill) */}
          {whatIfDelta !== 0 &&
            sortedGoals.map((goal, i) => (
              <Area
                key={`${goal.id}_whatif`}
                type="monotone"
                dataKey={`${goal.name}_whatif`}
                stroke={COLORS[i % COLORS.length]}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                dot={false}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
