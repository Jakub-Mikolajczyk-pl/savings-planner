import { useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarClock, ListChecks, ReceiptText, type LucideIcon } from 'lucide-react'
import { useStore } from '../../store'
import { buildSchedule } from '../../domain/allocation'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import {
  buildProjectionDashboardModel,
  type ProjectionDebtItem,
  type ProjectionGoalItem,
  type ProjectionPerspective,
} from '../../domain/projection'
import type { Goal, Loan } from '../../domain/types'

const GOAL_COLORS = ['#4f46e5', '#0f766e', '#ca8a04', '#7c3aed', '#db2777', '#0891b2']
const DEBT_COLORS = ['#dc2626', '#ea580c', '#b91c1c', '#c2410c']
const WHAT_IF_COLOR = '#6b7280'

type LayerKey = 'whatIf' | 'deadlines' | 'expenses'

interface ChartPoint {
  label: string
  yearMonth: string
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
  const [perspective, setPerspective] = useState<ProjectionPerspective | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    whatIf: true,
    deadlines: true,
    expenses: true,
  })

  const schedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const hasWhatIf = whatIfDelta !== 0 || loanOverpayment > 0
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
  const model = useMemo(
    () => buildProjectionDashboardModel({ schedule, whatIfSchedule, goals, loans, goalInsights, hasWhatIf }),
    [schedule, whatIfSchedule, goals, loans, goalInsights, hasWhatIf],
  )

  const knownIds = useMemo(() => new Set([...model.goals.map(goal => goal.id), ...model.debts.map(debt => debt.id)]), [model.goals, model.debts])
  const activePerspective = perspective ?? model.defaultPerspective
  const activeSelectedId = selectedId && knownIds.has(selectedId) ? selectedId : model.defaultSelectedId
  const visibleGoals = visibleGoalItems(model.goals, activePerspective, activeSelectedId)
  const visibleDebts = visibleDebtItems(model.debts, activePerspective, activeSelectedId)
  const visibleMonths = new Set(schedule.rows.map(row => row.yearMonth))
  const upcomingMarkers = upcomingExpenses
    .filter(expense => !expense.isPaid && visibleMonths.has(expense.targetMonth))
    .sort((a, b) => a.targetMonth.localeCompare(b.targetMonth))
  const data = useMemo(
    () => buildChartPoints(schedule, whatIfSchedule, goals, loans),
    [schedule, whatIfSchedule, goals, loans],
  )
  const tickInterval = Math.max(1, Math.floor(data.length / 10))

  if (goals.length === 0 && loans.length === 0 && upcomingMarkers.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Dodaj cele lub kredyty, żeby zobaczyć prognozę.</p>
  }

  return (
    <div className="space-y-4">
      {goalInsights && goalInsights.cycleCount > 0 && (
        <div className="grid gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 sm:grid-cols-3">
          <Metric label="Realne tempo" value={`${formatPLN(goalInsights.averageNetPerCycle)}/cykl`} tone={goalInsights.averageNetPerCycle < 0 ? 'negative' : 'positive'} />
          <Metric label="Wolna gotówka" value={`${formatPLN(goalInsights.averageFreeCashPerCycle)}/cykl`} />
          <Metric label="Historia" value={`${goalInsights.cycleCount} pełnych cykli`} />
        </div>
      )}

      <ProjectionToolbar
        perspective={activePerspective}
        layers={layers}
        hasWhatIf={hasWhatIf}
        onPerspectiveChange={setPerspective}
        onLayerToggle={key => setLayers(current => ({ ...current, [key]: !current[key] }))}
      />

      <div className="min-h-[340px]">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval - 1} className="fill-gray-500" />
            <YAxis tickFormatter={v => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} width={42} className="fill-gray-500" />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [formatPLN(value), tooltipName(String(name), goals, loans)]}
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
              labelFormatter={label => String(label ?? '')}
            />

            {visibleGoals.map((item, index) => {
              const color = GOAL_COLORS[index % GOAL_COLORS.length]
              const selected = item.id === activeSelectedId
              return (
                <Area
                  key={item.id}
                  type="monotone"
                  dataKey={`goal_${item.goalId}`}
                  name={`goal_${item.goalId}`}
                  stroke={color}
                  fill={color}
                  fillOpacity={selected ? 0.16 : 0.05}
                  strokeOpacity={selected ? 1 : 0.45}
                  strokeWidth={selected ? 2.5 : 1.5}
                  dot={false}
                  activeDot={{ r: selected ? 4 : 3 }}
                />
              )
            })}

            {visibleDebts.map((item, index) => {
              const color = DEBT_COLORS[index % DEBT_COLORS.length]
              const selected = item.id === activeSelectedId
              return (
                <Line
                  key={item.id}
                  type="monotone"
                  dataKey={`debt_${item.debtId}`}
                  name={`debt_${item.debtId}`}
                  stroke={color}
                  strokeOpacity={selected ? 1 : 0.5}
                  strokeWidth={selected ? 2.5 : 1.5}
                  dot={false}
                  activeDot={{ r: selected ? 4 : 3 }}
                />
              )
            })}

            {layers.whatIf && hasWhatIf && visibleGoals.map(item => (
              <Line
                key={`wi-${item.id}`}
                type="monotone"
                dataKey={`wi_goal_${item.goalId}`}
                name={`wi_goal_${item.goalId}`}
                stroke={WHAT_IF_COLOR}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
              />
            ))}

            {layers.whatIf && hasWhatIf && visibleDebts.map((item, index) => (
              <Line
                key={`wi-${item.id}`}
                type="monotone"
                dataKey={`wi_debt_${item.debtId}`}
                name={`wi_debt_${item.debtId}`}
                stroke={DEBT_COLORS[index % DEBT_COLORS.length]}
                strokeDasharray="5 4"
                strokeOpacity={0.65}
                strokeWidth={1.5}
                dot={false}
              />
            ))}

            {layers.deadlines && visibleGoals.map((item, index) => {
              const goal = goals.find(goal => goal.id === item.goalId)
              if (!goal?.deadline) return null
              return (
                <ReferenceLine
                  key={`deadline-${item.id}`}
                  x={formatYearMonth(goal.deadline.slice(0, 7))}
                  stroke={GOAL_COLORS[index % GOAL_COLORS.length]}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                />
              )
            })}

            {layers.deadlines && visibleDebts.map((item, index) => item.eta ? (
              <ReferenceLine
                key={`payoff-${item.id}`}
                x={formatYearMonth(item.eta)}
                stroke={DEBT_COLORS[index % DEBT_COLORS.length]}
                strokeDasharray="4 3"
                strokeOpacity={0.6}
              />
            ) : null)}

            {layers.expenses && upcomingMarkers.map(expense => (
              <ReferenceLine
                key={`expense-${expense.id}`}
                x={formatYearMonth(expense.targetMonth)}
                stroke="#7c3aed"
                strokeDasharray="3 3"
                strokeOpacity={0.45}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProjectionGoalList goals={model.goals} selectedId={activeSelectedId} onSelect={id => { setSelectedId(id); setPerspective('goals') }} />
        <ProjectionDebtList debts={model.debts} selectedId={activeSelectedId} onSelect={id => { setSelectedId(id); setPerspective('debts') }} />
      </div>
    </div>
  )
}

function buildChartPoints(schedule: ReturnType<typeof buildSchedule>, whatIfSchedule: ReturnType<typeof buildSchedule>, goals: Goal[], loans: Loan[]): ChartPoint[] {
  return schedule.rows.map((row, index) => {
    const point: ChartPoint = { label: row.label, yearMonth: row.yearMonth }
    goals.forEach(goal => {
      point[`goal_${goal.id}`] = row.goalAllocations.find(allocation => allocation.goalId === goal.id)?.balanceAfter ?? 0
      point[`wi_goal_${goal.id}`] = whatIfSchedule.rows[index]?.goalAllocations.find(allocation => allocation.goalId === goal.id)?.balanceAfter ?? 0
    })
    loans.forEach(loan => {
      point[`debt_${loan.id}`] = row.loanEntries.find(entry => entry.loanId === loan.id)?.balanceAfter ?? 0
      point[`wi_debt_${loan.id}`] = whatIfSchedule.rows[index]?.loanEntries.find(entry => entry.loanId === loan.id)?.balanceAfter ?? 0
    })
    return point
  })
}

function visibleGoalItems(goals: ProjectionGoalItem[], perspective: ProjectionPerspective, selectedId?: string) {
  if (perspective === 'debts') return []
  if (perspective === 'all') return goals.filter(goal => goal.id === selectedId).slice(0, 1)
  return goals
}

function visibleDebtItems(debts: ProjectionDebtItem[], perspective: ProjectionPerspective, selectedId?: string) {
  if (perspective === 'goals') return []
  if (perspective === 'all') return debts.filter(debt => debt.id === selectedId).slice(0, 1)
  return debts
}

function tooltipName(key: string, goals: Goal[], loans: Loan[]) {
  if (key.startsWith('wi_goal_')) return `${goals.find(goal => goal.id === key.replace('wi_goal_', ''))?.name ?? key} (scenariusz)`
  if (key.startsWith('goal_')) return goals.find(goal => goal.id === key.replace('goal_', ''))?.name ?? key
  if (key.startsWith('wi_debt_')) return `${loans.find(loan => loan.id === key.replace('wi_debt_', ''))?.name ?? key} (nadpłata)`
  if (key.startsWith('debt_')) return loans.find(loan => loan.id === key.replace('debt_', ''))?.name ?? key
  return key
}

function ProjectionToolbar({
  perspective,
  layers,
  hasWhatIf,
  onPerspectiveChange,
  onLayerToggle,
}: {
  perspective: ProjectionPerspective
  layers: Record<LayerKey, boolean>
  hasWhatIf: boolean
  onPerspectiveChange: (perspective: ProjectionPerspective) => void
  onLayerToggle: (key: LayerKey) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
        {[
          ['goals', 'Cele'],
          ['debts', 'Długi'],
          ['all', 'Wszystko'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPerspectiveChange(value as ProjectionPerspective)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              perspective === value
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-950'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <LayerButton active={layers.whatIf && hasWhatIf} disabled={!hasWhatIf} label="What-if" onClick={() => onLayerToggle('whatIf')} />
        <LayerButton active={layers.deadlines} label="Deadline" onClick={() => onLayerToggle('deadlines')} />
        <LayerButton active={layers.expenses} label="Wydatki" onClick={() => onLayerToggle('expenses')} />
      </div>
    </div>
  )
}

function LayerButton({ active, disabled = false, label, onClick }: { active: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function ProjectionGoalList({ goals, selectedId, onSelect }: { goals: ProjectionGoalItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <ProjectionListShell title="Najbliższe cele" icon={ListChecks}>
      {goals.length === 0 ? (
        <EmptyState text="Brak aktywnych celów." />
      ) : goals.slice(0, 6).map(goal => (
        <ProjectionRow key={goal.id} active={goal.id === selectedId} onClick={() => onSelect(goal.id)}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{goal.name}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {formatPLN(goal.current)} / {formatPLN(goal.target)} · brakuje {formatPLN(goal.remaining)}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{goal.eta ? formatYearMonth(goal.eta) : 'brak ETA'}</p>
            <p className={goal.status === 'behind_plan' || goal.status === 'unreachable' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}>
              {goal.actualPerCycle !== undefined ? `${formatPLN(goal.actualPerCycle)}/cykl` : 'brak historii'}
            </p>
            {goal.whatIfEtaDeltaMonths !== undefined && goal.whatIfEtaDeltaMonths !== 0 && (
              <p className="text-emerald-600 dark:text-emerald-400">what-if {goal.whatIfEtaDeltaMonths > 0 ? '+' : ''}{goal.whatIfEtaDeltaMonths} mies.</p>
            )}
          </div>
        </ProjectionRow>
      ))}
    </ProjectionListShell>
  )
}

function ProjectionDebtList({ debts, selectedId, onSelect }: { debts: ProjectionDebtItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <ProjectionListShell title="Najbliższe spłaty" icon={ReceiptText}>
      {debts.length === 0 ? (
        <EmptyState text="Brak aktywnych rat." />
      ) : debts.slice(0, 6).map(debt => (
        <ProjectionRow key={debt.id} active={debt.id === selectedId} onClick={() => onSelect(debt.id)}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{debt.name}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Saldo {formatPLN(debt.balance)}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{debt.eta ? formatYearMonth(debt.eta) : 'brak ETA'}</p>
            <p className="text-gray-500 dark:text-gray-400">{formatPLN(debt.monthlyPayment)}/mies.</p>
            {debt.whatIfPayoffDeltaMonths !== undefined && debt.whatIfPayoffDeltaMonths > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400">nadpłata -{debt.whatIfPayoffDeltaMonths} mies.</p>
            )}
          </div>
        </ProjectionRow>
      ))}
    </ProjectionListShell>
  )
}

function ProjectionListShell({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <Icon size={15} className="text-gray-500 dark:text-gray-400" />
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  )
}

function ProjectionRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-gray-50 dark:bg-gray-800/70' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      {children}
    </button>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-semibold tabular-nums ${
        tone === 'positive'
          ? 'text-teal-700 dark:text-teal-300'
          : tone === 'negative'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-gray-900 dark:text-gray-100'
      }`}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-400 dark:text-gray-500">
      <CalendarClock size={14} />
      {text}
    </div>
  )
}
