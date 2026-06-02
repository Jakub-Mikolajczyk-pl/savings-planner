import { useEffect } from 'react'
import { Activity, Gauge, Target } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { formatPLN } from '../../domain/formatting'
import type { FreeCashCycle, GoalPace, GoalPaceStatus } from '../../domain/types'
import { useStore } from '../../store'

export function GoalInsightsSection() {
  const goals = useStore(s => s.goals)
  const goalInsights = useStore(s => s.goalInsights)
  const loadGoalInsights = useStore(s => s.loadGoalInsights)

  useEffect(() => {
    if (IS_API_MODE) void loadGoalInsights()
  }, [loadGoalInsights, goals.length])

  if (!IS_API_MODE) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Realne tempo celów jest dostępne w trybie API po imporcie transakcji bankowych.
      </div>
    )
  }

  if (!goalInsights) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ładuję realne tempo celów...</p>
  }

  if (!goalInsights.currentCycle && goalInsights.goals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Brak cykli i celów do policzenia. Ustaw kotwice wypłaty oraz dodaj cele.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        {goalInsights.currentCycle ? (
          <FreeCashPanel cycle={goalInsights.currentCycle} />
        ) : (
          <EmptyPanel title="Wolna gotówka" text="Brak cykli budżetowych. Ustaw kotwice wypłaty w Transakcjach." />
        )}

        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Gauge size={16} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tempo z historii</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <Metric label="Pełne cykle" value={String(goalInsights.cycleCount)} />
            <Metric label="Średnie netto" value={formatPLN(goalInsights.averageNetPerCycle)} tone={goalInsights.averageNetPerCycle < 0 ? 'negative' : 'positive'} />
            <Metric label="Średnia wolna gotówka" value={formatPLN(goalInsights.averageFreeCashPerCycle)} tone="positive" />
          </div>
        </div>
      </div>

      {goalInsights.goals.length > 0 && (
        <div className="rounded-md border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            <Target size={16} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cele actual-vs-plan</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-900">
            {goalInsights.goals.map(goal => <GoalPaceRow key={goal.goalId} goal={goal} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function FreeCashPanel({ cycle }: { cycle: FreeCashCycle }) {
  const total = Math.max(cycle.income, cycle.committedExpense + Math.max(0, cycle.freeCash), 1)
  const committedPct = clampPct(cycle.committedExpense / total)
  const freePct = clampPct(Math.max(0, cycle.freeCash) / total)
  const variableUsedPct = cycle.freeCash > 0 ? clampPct((cycle.variableExpense + cycle.uncategorizedExpense) / cycle.freeCash) : 0

  return (
    <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-gray-500 dark:text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Wolna gotówka bieżącego cyklu</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {cycle.accountName}: {cycle.periodStart} - {cycle.periodEnd ?? 'teraz'}{cycle.isPartial ? ' (częściowy)' : ''}
            </p>
          </div>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${cycle.net < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-700 dark:text-teal-300'}`}>
          netto {formatPLN(cycle.net)}
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800" aria-label="Podział przychodu w cyklu">
        <div className="flex h-full">
          <div className="bg-gray-400/70 dark:bg-gray-500/70" style={{ width: `${committedPct}%` }} />
          <div className="bg-teal-500/80" style={{ width: `${freePct}%` }} />
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-3">
        <span>Koszty stałe: {formatPLN(cycle.committedExpense)}</span>
        <span>Wolna gotówka: {formatPLN(cycle.freeCash)}</span>
        <span>Uznaniowe z wolnej: {formatPLN(cycle.variableExpense + cycle.uncategorizedExpense)} ({Math.round(variableUsedPct)}%)</span>
      </div>
    </div>
  )
}

function GoalPaceRow({ goal }: { goal: GoalPace }) {
  const progress = goal.targetAmount > 0 ? clampPct(goal.currentSaved / goal.targetAmount) : 0
  const status = statusCopy(goal.status)

  return (
    <div className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {goal.priority}
          </span>
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{goal.name}</p>
          <span className={`rounded-sm px-1.5 py-0.5 text-xs ${status.className}`}>{status.label}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-sm bg-teal-500/80" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formatPLN(goal.currentSaved)} / {formatPLN(goal.targetAmount)}; zostalo {formatPLN(goal.remainingAmount)}
        </p>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
        <Metric label="Plan / cykl" value={goal.plannedPerCycle ? formatPLN(goal.plannedPerCycle) : 'kolejka'} />
        <Metric label="Realnie / cykl" value={formatPLN(goal.actualPerCycle)} tone={goal.actualPerCycle > 0 ? 'positive' : 'negative'} />
        <Metric label="Projekcja" value={projectionLabel(goal)} />
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive'
    ? 'text-teal-700 dark:text-teal-300'
    : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-gray-900 dark:text-gray-100'

  return (
    <div>
      <p className="text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  )
}

function projectionLabel(goal: GoalPace) {
  if (goal.status === 'complete') return 'cel osiagniety'
  if (goal.status === 'no_history') return 'brak historii'
  if (!goal.projectedCycles) return 'nieosiagalny'
  return `za ${goal.projectedCycles} cykli`
}

function statusCopy(status: GoalPaceStatus): { label: string; className: string } {
  switch (status) {
    case 'complete':
      return { label: 'gotowe', className: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' }
    case 'no_history':
      return { label: 'brak historii', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' }
    case 'unreachable':
      return { label: 'nieosiagalny', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' }
    case 'behind_plan':
      return { label: 'poniżej planu', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' }
    case 'on_track':
      return { label: 'realne tempo', className: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' }
  }
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, value * 100))
}
